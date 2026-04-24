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

// 2. Database Connection
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000
}).then(() => logger.info('✅ MongoDB Connected'))
    .catch(err => logger.error('❌ DB Error:', err));

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
app.use('/auth', authRoutes);
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
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message,
        timestamp: new Date().toISOString()
    });
});

// One-time startup task: Promote specific user to admin
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

// Start Server
const PORT = process.env.PORT || 3000;
http.listen(PORT, async () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    await promoteAyaToAdmin();
    await seedSampleProducts();
});

async function seedSampleProducts() {
    try {
        const count = await Product.countDocuments();
        if (count > 0) return;

        // Get the first admin user to assign products to
        let adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            // Create a dummy admin if none exists
            adminUser = new User({
                name: 'متركنهاش',
                email: 'admin@matrknhash.com',
                password: 'placeholder_password',
                role: 'admin'
            });
            await adminUser.save();
        }

        const samples = [
            {
                name: "طقم مساعدين أمامى (KYB)",
                brand: "Toyota",
                price: 4500,
                category: "Suspension",
                vendorId: adminUser._id,
                image: "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=400",
                description: "مساعدين ياباني أصلي ماركة KYB متوافقة مع تويوتا كورولا 2014-2022.",
                stockQuantity: 10,
                condition: "جديد",
                warranty: "6 شهور",
                tags: ["مساعدين", "تويوتا", "عفشة"],
                vendorName: "متركنهاش"
            },
            {
                name: "تيل فرامل أمامى (Valeo)",
                brand: "Hyundai",
                price: 1250,
                category: "Brakes",
                vendorId: adminUser._id,
                image: "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=400",
                description: "تيل فرامل فرنسي أصلي يضمن أداء متميز وهدوء تام عند الكبح.",
                stockQuantity: 25,
                condition: "جديد",
                warranty: "سنة",
                tags: ["تيل", "فرامل", "هيونداي"],
                vendorName: "متركنهاش"
            },
            {
                name: "طقم بوجيهات (NGK Iridium)",
                brand: "Nissan",
                price: 950,
                category: "Engine",
                vendorId: adminUser._id,
                image: "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=400",
                description: "بوجيهات إيريديوم لزيادة كفاءة الاحتراق وتوفير استهلاك الوقود.",
                stockQuantity: 50,
                condition: "جديد",
                warranty: "شهر",
                tags: ["بوجيهات", "محرك", "نيسان"],
                vendorName: "متركنهاش"
            }
        ];

        await Product.insertMany(samples);
        logger.info('✅ Sample products seeded successfully.');
    } catch (err) {
        logger.error('Seeding Error:', err);
    }
}
