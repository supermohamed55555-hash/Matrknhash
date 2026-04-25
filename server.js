require('dotenv').config();
const logger = require('./utils/logger'); // Move logger import up
const Sentry = require('@sentry/node');

// --- Professional Error Handling ---
process.on('uncaughtException', (err) => {
    logger.error('CRITICAL: Uncaught Exception!', err);
    Sentry.captureException(err);
    // Give some time for logging before exiting
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
    Sentry.captureException(reason);
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');

const Order = require('./models/Order');
const shippingService = require('./utils/shipping');

// Last Deployment Update: 2026-02-19
// Logging & Monitoring (Already moved to top)
const morgan = require('morgan');

// Initialize Sentry (Fallback if DSN is missing)
Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: 1.0,
    integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
    ],
});

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Allow all for now
});

// Map to store userId -> socketId
const connectedUsers = new Map();

io.on('connection', (socket) => {
    logger.info(`New Client Connected: ${socket.id}`);

    // Register user and join appropriate rooms
    socket.on('register', async (data) => {
        try {
            if (!data) return;
            // data can be userId or { userId, role }
            const userId = (data && typeof data === 'object') ? data.userId : data;
            const role = (data && typeof data === 'object') ? data.role : null;

            if (!userId) return;

            connectedUsers.set(userId, socket.id);

            // If it's an admin, join the admins room to get ALL order notifications
            if (role === 'admin') {
                socket.join('admins');
                logger.info(`Admin ${userId} joined admins room`);
            }

            logger.info(`User ${userId} registered to socket ${socket.id}`);
        } catch (err) {
            logger.error('Socket Registration Error:', err);
        }
    });

    socket.on('disconnect', () => {
        for (const [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                break;
            }
        }
    });
});

app.set('trust proxy', 1); // Trust Railway's proxy for secure cookies and OAuth

app.use(Sentry.Handlers.requestHandler()); // Sentry Request Handler triggers first
app.use(Sentry.Handlers.tracingHandler()); // TracingHandler creates a trace for every incoming request

// Morgan HTTP Logger (Stream to Winston)
app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// --- NoSQL Injection Protection ---
app.use(mongoSanitize());

// --- Security Fix: Prevent serving sensitive files ---
app.use((req, res, next) => {
    const forbiddenFiles = ['server.js', '.env', 'package.json', 'package-lock.json', 'fix-role.js', 'check-db.js'];
    const forbiddenExts = ['.log', '.md', '.env'];
    const url = req.url.toLowerCase().split('?')[0];

    if (forbiddenFiles.some(f => url === '/' + f || url.endsWith('/' + f))) {
        return res.status(403).send('<h1>403 Forbidden</h1><p>عذراً، غير مسموح بالوصول لهذا الملف لأسباب أمنية.</p>');
    }
    if (forbiddenExts.some(ext => url.endsWith(ext))) {
        return res.status(403).send('<h1>403 Forbidden</h1><p>عذراً، غير مسموح بالوصول لهذا الملف.</p>');
    }
    next();
});

// --- Static Serving (SPA-friendly) ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mtrknhash_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Passport Local Strategy ---
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user || !user.password) return done(null, false, { message: 'بيانات الدخول غير صحيحة' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'بيانات الدخول غير صحيحة' });

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.findById(id).then(user => done(null, user));
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const existingUser = await User.findOne({ googleId: profile.id });
            if (existingUser) return done(null, existingUser);

            const newUser = await new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value
            }).save();
            done(null, newUser);
        } catch (err) {
            done(err, null);
        }
    }
));

// --- Auth Middleware ---
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Please log in' });
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated()) {
        // FAIL-SAFE: Allow specific email or admin role
        if (req.user.email === 'supermohamed55555@gmail.com' || req.user.role === 'admin') {
            return next();
        }
    }
    res.status(403).json({ error: 'Forbidden: Admin access only' });
}

// 2. Database Connection & Server Start
async function startServer() {
    try {
        let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri || mongoUri.includes('your_password')) {
            throw new Error('❌ Invalid or missing MONGO_URI in environment variables!');
        }

        mongoUri = mongoUri.trim();
        logger.info('⏳ Connecting to MongoDB Atlas...');

        const connectionOptions = mongoUri.startsWith('mongodb+srv') 
            ? { serverSelectionTimeoutMS: 30000, socketTimeoutMS: 45000, dbName: 'mtrknhash', maxPoolSize: 10 }
            : { serverSelectionTimeoutMS: 30000 };

        await mongoose.connect(mongoUri, connectionOptions);
        logger.info('✅ Database Connection Established Successfully');

        const PORT = process.env.PORT || 3000;
        http.listen(PORT, async () => {
            logger.info(`🚀 Server is live on port ${PORT}`);
            
            // Post-connection tasks
            try {
                await promoteAyaToAdmin();
                await seedSampleProducts();
                logger.info('✨ Initial startup tasks completed');
            } catch (taskErr) {
                logger.error('⚠️ Startup tasks failed:', taskErr);
            }
        });

    } catch (err) {
        logger.error('❌ CRITICAL STARTUP ERROR:', err.message);
        process.exit(1);
    }
}

startServer();

// --- Routes Modularization ---
const authRoutes = require('./routes/auth').router;
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const vendorRoutes = require('./routes/vendor');
const aiRoutes = require('./routes/ai');

// Share io and connectedUsers with routes
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// Apply Routes
@app.use('/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api', aiRoutes);

// Frontend Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/profile', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public/profile.html')));
app.get('/product-detail', (req, res) => res.sendFile(path.join(__dirname, 'public/product-detail.html')));
app.get('/admin', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/super-admin', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public/super-admin.html')));

// Legacy fallback for .html extensions
app.get('/:page.html', (req, res) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'up',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// --- Error Handling & Cleanup ---

// Sentry Error Handler (Must be before any other error middleware)
app.use(Sentry.Handlers.errorHandler());

// Professional Custom Error Response
app.use((err, req, res, next) => {
    logger.error(`Error processing ${req.method} ${req.url}:`, err);

    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message, // Verbose for debugging
        timestamp: new Date().toISOString()
    });
});

// One-time startup task: Promote specific user to admin
app.get('/test-db', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const userCount = await User.countDocuments();
        const firstProduct = await Product.findOne();
        res.json({ productCount, userCount, firstProduct, status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

async function promoteAyaToAdmin() {
    try {
        const targetEmail = 'ayaabdelnasser165@gmail.com';
        const user = await User.findOne({ email: targetEmail });
        if (user) {
            if (user.role !== 'admin') {
                user.role = 'admin';
                await user.save();
                logger.info(`🎉 User ${targetEmail} has been promoted to ADMIN automatically.`);
            }
        } else {
            logger.warn(`⚠️ Promotion failed: User ${targetEmail} not found. Tell them to register first!`);
        }
    } catch (err) {
        logger.error('Error in auto-promotion:', err);
    }
}

// (Server start logic moved to startServer function above)

async function seedSampleProducts() {
    try {
        await Product.deleteMany({ vendorName: 'متركنهاش' });
        
        let adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            logger.info('Creating default admin user for seeding...');
            adminUser = new User({
                name: 'متركنهاش',
                email: 'admin@matrknhash.com',
                password: 'placeholder_password',
                role: 'admin',
                status: 'active'
            });
            await adminUser.save();
        }

        if (!adminUser || !adminUser._id) {
            throw new Error('Admin user could not be found or created for seeding.');
        }

        const brands = ["Toyota", "Hyundai", "Nissan", "BMW", "Mercedes", "Kia", "Mitsubishi", "Renault", "Ford", "Honda"];
        const categoryConfig = {
            "Engine": {
                parts: ["محرك كامل استيراد", "طقم شمبر", "طلمبة زيت", "سير كاتينة جيتس", "طقم جوانات موتور"],
                priceRange: [8000, 25000],
                image: "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcR-vxMKauivsMwiTGPnHsUvWgCthbbsU7l1xAjRQuIyYch1hM-BS6_epBbwuI0L",
                desc: "أداء فائق واعتمادية عالية لمحرك سيارتك مع قطع غيار أصلية."
            },
            "Brakes": {
                parts: ["تيل فرامل أمامى", "طنبورة فرامل", "ماستر فرامل عمومي", "تيل فرامل خلفي", "خراطيم فرامل"],
                priceRange: [300, 2000],
                image: "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcTHfR9LPkL1XoaXHq_iU0OwKgDgB9PhvH-VkjOokn0zx-6tlnTYM7dWbQDRvpx3",
                desc: "أمانك يبدأ من هنا. قطع غيار فرامل تضمن لك كبحاً آمناً وهادئاً."
            },
            "Battery": {
                parts: ["بطارية 70 أمبير", "بطارية 60 أمبير جافة", "بطارية AC Delco", "بطارية فارتا"],
                priceRange: [1500, 4500],
                image: "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRlqWHFHoAAcGIqfO85QOfKlkg6i0jl7Djm5yicrzevzZbMQ7KMQim0NFrXDeq_",
                desc: "طاقة لا تنقطع. بطاريات أصلية بضمان حقيقي لأطول عمر افتراضي."
            },
            "Tires": {
                parts: ["إطارات ميشلان 15", "إطارات بريدجستون 16", "إطارات هانكوك 14", "إطار بيرللي سبورت"],
                priceRange: [2000, 6000],
                image: "https://images.unsplash.com/photo-1549441412-1045244391d6?auto=format&fit=crop&q=80&w=400",
                desc: "ثبات على الطريق وتحكم كامل في جميع الظروف الجوية."
            },
            "Electricity": {
                parts: ["دينامو شحن", "مارش استيراد", "طقم بوجيهات ليزر", "حساس أكسجين", "موبينة إشعال"],
                priceRange: [500, 2500],
                image: "https://js-alternators.com/cdn/shop/files/11237-splitear-angle-337_11e88811-90ce-454e-b5a3-3a8f43e98203.png?v=1708699022&width=720",
                desc: "أنظمة كهربائية متطورة تضمن كفاءة تشغيل كافة وظائف السيارة."
            },
            "Suspension": {
                parts: ["طقم مساعدين KYB", "مقص أمامى يمين", "بيض طرف دركسيون", "جلب مقصات", "مساعدين خلفي"],
                priceRange: [1000, 5000],
                image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400",
                desc: "راحة تامة في القيادة وامتصاص مثالي للصدمات على الطرق الوعرة."
            },
            "Cooling": {
                parts: ["رادياتير مياه", "طلمبة مياه", "ترموستات كوعة", "مروحة تبريد", "قربة مياه"],
                priceRange: [600, 3500],
                image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=400",
                desc: "نظام تبريد متطور يحمي محركك من الحرارة الزائدة في أصعب الظروف."
            }
        };

        const samples = [];
        const catKeys = Object.keys(categoryConfig);

        for (let i = 0; i < 50; i++) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const catKey = catKeys[Math.floor(Math.random() * catKeys.length)];
            const config = categoryConfig[catKey];
            const partName = config.parts[Math.floor(Math.random() * config.parts.length)];
            const price = Math.floor(Math.random() * (config.priceRange[1] - config.priceRange[0])) + config.priceRange[0];
            
            const badges = [null, "جديد", "الأكثر طلباً", null, null];
            const badge = badges[Math.floor(Math.random() * badges.length)];
            const availability = Math.random() > 0.1 ? "متوفر" : "غير متوفر";
            const stock = availability === "متوفر" ? Math.floor(Math.random() * 30) + 5 : 0;

            samples.push({
                name: `${partName} - ${brand}`,
                brand: brand,
                price: price,
                category: catKey,
                vendorId: adminUser._id,
                image: config.image,
                description: config.desc,
                stockQuantity: stock,
                condition: "جديد",
                warranty: "6 شهور",
                badge: badge,
                tags: [catKey, brand, availability],
                vendorName: "متركنهاش",
                status: 'active'
            });
        }

        await Product.insertMany(samples);
        logger.info('✅ 50 realistic automotive products seeded successfully.');
    } catch (err) {
        logger.error('❌ Error seeding products:', err);
    }
}
