require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

const app = express();

// 1. Middleware Setup (Must be BEFORE routes)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use(session({
    secret: 'mtrknhash_secret_key',
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

// 2. Database Connection
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000
}).then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Error:', err));

// 3. Routes

// Root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Auth Persistence Check
app.get('/auth/login/success', (req, res) => {
    if (req.user) {
        res.json({
            success: true,
            user: {
                name: req.user.name,
                role: req.user.role,
                shopName: req.user.shopName
            }
        });
    } else {
        res.json({ success: false });
    }
});

// API Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, phone, role, shopName, location } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: role || 'user',
            shopName,
            location
        });

        await newUser.save();
        res.status(201).json({ success: true, message: 'تم التسجيل بنجاح' });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ error: 'فشل عملية التسجيل' });
    }
});

// API Login
app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ error: 'حدث خطأ ما' });
        if (!user) return res.status(401).json({ error: info.message || 'بيانات الدخول غير صحيحة' });

        req.logIn(user, (err) => {
            if (err) return res.status(500).json({ error: 'فشل تسجيل الدخول' });
            return res.json({
                success: true,
                user: {
                    name: user.name,
                    role: user.role,
                    shopName: user.shopName
                }
            });
        });
    })(req, res, next);
});

// Logout
app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Google Auth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/?user=' + encodeURIComponent(req.user.name));
    }
);

// --- Product APIs ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.post('/api/products', isAuthenticated, async (req, res) => {
    try {
        const { name, brand, price, image, category, description, vendorName, condition, warranty, compatibility } = req.body;
        const newProduct = new Product({
            name, brand, price, image, category, description,
            vendorName, condition, warranty,
            compatibility: compatibility || []
        });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        console.error('Add Product Error:', err);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// Fitment Checker API (Real AI + Strict Fallback)
app.post('/api/check-fitment', async (req, res) => {
    try {
        const { productId, userText } = req.body;
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });

        const compatibilityData = product.compatibility && product.compatibility.length > 0
            ? product.compatibility.map(c => `- ${c.brand} ${c.model} | ${c.yearStart} – ${c.yearEnd}`).join('\n')
            : "لا توجد بيانات توافق محددة لهذه القطعة.";

        const geminiKey = process.env.GEMINI_API_KEY;

        // Structure the Prompt for the "Premium" experience
        const aiPrompt = `
أنت "المهندس عبود"، خبير فني في قطع غيار السيارات بموقع "متركنهاش". 
صديق للعملاء لكنك تقني ومخضرم.

وظيفتك:
1. فحص توافق القطعة (${product.name}) مع سيارة العميل بناءً على البيانات المقدمة.
2. استخدام بيانات التوافق المتاحة فقط كمرجع أصلي.
3. التحدث بلهجة "مهندس مختص" (ودود، احترافي، مباشر).

بيانات التوافق للقطعة:
${compatibilityData}

سؤال العميل:
"${userText}"

قواعد الإجابة:
- إذا كانت مناسبة: ابدأ بـ "مبروك يا بطل، القطعة دي بتركب عندك زي السكينة في الحلاوة..." ثم اشرح ليه (السنة والموديل).
- إذا كانت غير مناسبة: "والله يا صاحبي للأسف القطعة دي ماتركبش عندك..." واذكر السبب التقني (مثلاً: الموديل ده نزل بنظام مختلف).
- إذا لم تتوفر بيانات كافية: اطلب منه يبعت لك (الماتور كام سي سي؟ أو الموديل مانيوال ولا أوتوماتيك؟) لو ده هيساعد.
- لا تزيد الإجابة عن سطرين. كن ذكياً ومقنعاً.
        `;

        // If Gemini Key is present, call the real AI
        if (geminiKey && geminiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
            try {
                // Using global fetch (Node 18+) to call Gemini API
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: aiPrompt }] }]
                    })
                });
                const aiData = await response.json();

                if (aiData.candidates && aiData.candidates[0]) {
                    const aiResponse = aiData.candidates[0].content.parts[0].text;

                    // Determine status based on keywords in AI response
                    let status = 'warning';
                    if (aiResponse.includes('نعم') || aiResponse.includes('مناسبة')) status = 'success';
                    if (aiResponse.includes('لا') || aiResponse.includes('غير مناسبة')) status = 'error';
                    if (aiResponse.includes('غير متأكد') || aiResponse.includes('توضيح')) status = 'warning';

                    return res.json({ status, reason: aiResponse });
                }
            } catch (aiErr) {
                console.error('Gemini API Error:', aiErr);
            }
        }

        // --- STRICT SIMULATION FALLBACK (If no API key or API fails) ---
        const query = userText.toLowerCase();

        if (!product.compatibility || product.compatibility.length === 0) {
            return res.json({
                status: 'warning',
                reason: 'لا أستطيع التأكد حاليًا لأن بيانات القطعة غير مكتملة. من فضلك تواصل مع الدعم.'
            });
        }

        const vehicleMatch = (text) => {
            const yMatch = text.match(/\d{4}/);
            const year = yMatch ? parseInt(yMatch[0]) : null;

            for (const c of product.compatibility) {
                const b = (c.brand || "").toLowerCase();
                const m = (c.model || "").toLowerCase();

                if (text.includes(b) || text.includes(m)) {
                    if (year) {
                        if (year >= c.yearStart && year <= c.yearEnd) {
                            return { status: 'success', reason: `نعم، القطعة مناسبة لعربيك لأن ${c.brand} ${c.model} موديل ${year} يقع ضمن نطاق التوافق من ${c.yearStart} إلى ${c.yearEnd}.` };
                        } else {
                            return { status: 'error', reason: `لا، القطعة غير مناسبة لعربيتك لأن موديل ${year} خارج نطاق السنوات المدعومة (${c.yearStart}-${c.yearEnd}).` };
                        }
                    } else {
                        return { status: 'warning', reason: "لا أستطيع التأكد حاليًا لأن بيانات السنة غير موجودة. من فضلك حدد سنة الموديل." };
                    }
                }
            }
            return null;
        };

        const result = vehicleMatch(query);
        if (result) return res.json(result);

        res.json({
            status: 'warning',
            reason: 'لم أجد هذه السيارة في قائمة التوافق بشكل واضح. هل يمكنك تحديد الماركة والموديل بدقة؟'
        });

    } catch (err) {
        console.error('Fitment Error:', err);
        res.status(500).json({ error: 'حدث خطأ في فحص التوافق' });
    }
});

app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

app.put('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, brand, price, image, category, description, vendorName, condition, warranty, compatibility } = req.body;
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                name, brand, price, image, category, description,
                vendorName, condition, warranty,
                compatibility: compatibility || []
            },
            { new: true } // Return the updated document
        );
        if (!updatedProduct) return res.status(404).json({ error: 'المنتج غير موجود' });
        res.json(updatedProduct);
    } catch (err) {
        console.error('Update Product Error:', err);
        res.status(500).json({ error: 'فشل تعديل المنتج' });
    }
});

// --- Order Routes ---
app.post('/api/orders', isAuthenticated, async (req, res) => {
    try {
        const { productName, price, image } = req.body;
        const newOrder = new Order({
            user: req.user._id,
            productName,
            price,
            image
        });
        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (err) {
        res.status(500).json({ error: 'Failed to place order' });
    }
});

app.get('/api/user-orders', isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.get('/api/current_user', (req, res) => {
    res.send(req.user);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
