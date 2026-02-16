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

// --- Security Fix: Prevent serving sensitive files ---
app.use((req, res, next) => {
    const forbiddenExts = ['.js', '.json', '.env', '.md', '.log'];
    const lowerUrl = req.url.toLowerCase();

    // Check if the request is for a forbidden file extension
    // But allow essential ones if they were specifically in a public folder (not applicable here as everything is root)
    if (forbiddenExts.some(ext => lowerUrl.endsWith(ext))) {
        return res.status(403).send('<h1>403 Forbidden</h1><p>عذراً، غير مسموح بالوصول لهذا الملف لأسباب أمنية.</p>');
    }
    next();
});

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
        let product = null;
        try {
            if (productId && mongoose.Types.ObjectId.isValid(productId)) {
                product = await Product.findById(productId);
            }
        } catch (e) {
            console.log("Invalid Product ID or DB Error, proceeding as general query");
        }

        const compatibilityData = product && product.compatibility && product.compatibility.length > 0
            ? product.compatibility.map(c => `- ${c.brand} ${c.model} | ${c.yearStart} – ${c.yearEnd}`).join('\n')
            : "لا توجد بيانات توافق محددة لهذه القطعة.";

        const geminiKey = process.env.GEMINI_API_KEY;

        // Structure the Prompt for the "Premium" experience
        const aiPrompt = `
أنت "المهندس عبود"، خبير فني مخضرم في ميكانيكا وصيانة السيارات بموقع "متركنهاش". 
صديق للعملاء، تقني، ومباشر، وبتتكلم بلهجة مصرية عامية "صنايعية شاطرة".

بيانات القطعة الحالية: ${product ? product.name : "غير محددة"}
بيانات التوافق: ${compatibilityData}

سؤال العميل:
"${userText}"

مهامك:
1. لو السؤال عن توافق القطعة المذكورة: افحص التوافق بناءً على البيانات المتوفرة.
2. لو السؤال عام في العربيات وبرا نطاق القطعة: جاوب كخبير مخضرم.
3. لو السؤال برا العربييات خالص: اعتذر بلطافة وقوله إن تخصصك في العربيات بس.

قواعد الإجابة:
- في التوافق: ابدأ بـ "مبروك يا بطل" لو بتركب، أو "للأسف ماتركبش" لو مش بتركب، واشرح السبب التقني بالتفصيل.
- في الأسئلة العامة: جاوب كخبير تقني حقيقي. لو المشكلة معقدة، قسم إجابتك لخطوات تشخيص (Diagnostic steps) وحلول محتملة.
- متخليش سؤال يعجزك؛ لو المعلومة مش كاملة، اطلب تفاصيل إضافية (زي نوع الموتور أو ظروف المشكلة) واقترح احتمالات بناءً على خبرتك.
- خلي ردك وافي وشامل، وماتقيدش نفسك بطول معين طالما الكلام تقني ومفيد.
- حافظ على اللهجة المصرية العامية "الشاطرة" والروح الودودة.
        `;

        const groqKey = process.env.GROQ_API_KEY || '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';

        // --- Groq Integration (Faster & Higher Quota) ---
        if (groqKey) {
            try {
                process.stdout.write(`\n--- Calling GROQ AI for: "${userText}" ---\n`);
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: [
                            { role: 'system', content: 'أنت "المهندس عبود"، خبير فني مخضرم في ميكانيكا وصيانة السيارات بموقع "متركنهاش". صديق للعملاء، وتتحدث بلهجة مصرية عامية "صنايعية شاطرة".' },
                            { role: 'user', content: aiPrompt }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    console.error('Groq API Error:', errData);
                    throw new Error(`Groq returned ${response.status}`);
                }

                const data = await response.json();
                const aiResponse = data.choices[0].message.content.trim();
                process.stdout.write(`Groq Answered: ${aiResponse.substring(0, 50)}...\n`);

                // Determine status based on keywords
                let status = 'warning';
                const resp = aiResponse.toLowerCase();
                if (resp.includes('مبروك') || resp.includes('مناسبة') || resp.includes('تنفع') || resp.includes('تركب')) status = 'success';
                if (resp.includes('للأسف') || resp.includes('ما تتركبش') || resp.includes('غير مناسبة') || resp.includes('ماتركبش')) status = 'error';
                if (resp.includes('اعتذر') || resp.includes('تخصصي')) status = 'warning';

                return res.json({ status, reason: aiResponse });
            } catch (err) {
                console.error('CRITICAL GROQ ERROR:', err.message);
            }
        }

        // --- STRICT SIMULATION FALLBACK (If no API key or AI block failed) ---
        const query = (userText || "").toLowerCase();

        // Avoid crashing if product is null
        if (product && product.compatibility && product.compatibility.length > 0) {
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
        }

        // Final Fallback for general questions if AI failed or fitment not found
        const errorMessage = (process.env.GROQ_API_KEY || (typeof groqKey !== 'undefined' && !groqKey.startsWith('YOUR_')))
            ? 'المهندس عبود بيقولك: "حصلت مشكلة تقنية عندي.. جرب كمان دقيقة. لو فضلت كدة قولي للذكاء الاصطناعي يشوف الـ Logs في Railway."'
            : '⚠️ تنبيه: مفتاح الـ API ممسوح أو مش شغال. لازم تظبطه في الـ Variable في Railway أولاً.';

        res.json({
            status: 'warning',
            reason: errorMessage
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
        const { items, totalPrice, shippingAddress, paymentMethod } = req.body;

        const newOrder = new Order({
            user: req.user._id,
            items: items.map(item => ({
                productId: item.productId,
                name: item.name,
                priceAtPurchase: item.price,
                image: item.image,
                quantity: item.quantity || 1,
                vendorId: item.vendorId || "متركنهاش"
            })),
            totalPrice,
            shippingAddress,
            paymentMethod: paymentMethod || 'Wallet',
            status: 'Pending'
        });

        // If paying by wallet, deduct balance
        if (paymentMethod === 'Wallet') {
            const user = await User.findById(req.user._id);
            if (user.walletBalance < totalPrice) {
                return res.status(400).json({ error: 'رصيد المحفظة غير كافٍ' });
            }
            user.walletBalance -= totalPrice;
            await user.save();
        }

        await newOrder.save();
        res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
        console.error('Order Error:', err);
        res.status(500).json({ error: 'فشل في إتمام الطلب' });
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

// --- Address Management ---
app.get('/api/user/addresses', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user.addresses || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

app.post('/api/user/addresses', isAuthenticated, async (req, res) => {
    try {
        const { label, details, isDefault } = req.body;
        const user = await User.findById(req.user._id);

        if (isDefault) {
            user.addresses.forEach(addr => addr.isDefault = false);
        }

        user.addresses.push({ label, details, isDefault });
        await user.save();
        res.status(201).json(user.addresses);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add address' });
    }
});

app.delete('/api/user/addresses/:id', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
        await user.save();
        res.json({ success: true, message: 'Address deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete address' });
    }
});

// --- Returns & Wallet ---
app.post('/api/orders/:id/return', isAuthenticated, async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        order.returnStatus = 'Requested';
        order.returnReason = reason;
        await order.save();
        res.json({ success: true, message: 'Return requested successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to request return' });
    }
});

app.get('/api/user-returns', isAuthenticated, async (req, res) => {
    try {
        const returns = await Order.find({
            user: req.user._id,
            returnStatus: { $ne: null }
        }).sort({ createdAt: -1 });
        res.json(returns);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch returns' });
    }
});

app.get('/api/user/wallet', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ balance: user.walletBalance || 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
});

// --- Garage Management ---
app.get('/api/user/garage', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user.garage || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch garage' });
    }
});

app.post('/api/user/garage', isAuthenticated, async (req, res) => {
    try {
        const { make, model, year, engine } = req.body;
        const user = await User.findById(req.user._id);

        // If first car, make it primary
        const isPrimary = (user.garage || []).length === 0;

        user.garage.push({ make, model, year, engine, isPrimary });
        await user.save();
        res.status(201).json(user.garage);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add car' });
    }
});

app.delete('/api/user/garage/:carId', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.garage = user.garage.filter(car => car._id.toString() !== req.params.carId);
        await user.save();
        res.json({ message: 'Car removed', garage: user.garage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove car' });
    }
});

app.patch('/api/user/garage/:carId/primary', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.garage.forEach(car => {
            car.isPrimary = (car._id.toString() === req.params.carId);
        });
        await user.save();
        res.json(user.garage);
    } catch (err) {
        res.status(500).json({ error: 'Failed to set primary car' });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
