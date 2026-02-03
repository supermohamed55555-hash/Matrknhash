require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

const app = express();

// --- Middleware لضمان تسجيل الدخول ---
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Please log in' });
}

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

// 1. Middleware Setup
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({ secret: 'mtrknhash_secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// 2. Database Connection
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000
}).then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Error:', err));

// 3. Authentication Configuration
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.findById(id).then(user => done(null, user));
});

if (process.env.GOOGLE_CLIENT_ID) {
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
} else {
    console.warn('⚠️ Google Client ID is missing. Google Login will not work.');
}


if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'YOUR_FACEBOOK_APP_ID_HERE') {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: "/auth/facebook/callback",
        profileFields: ['id', 'displayName', 'emails']
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const existingUser = await User.findOne({ facebookId: profile.id });
                if (existingUser) return done(null, existingUser);

                const newUser = await new User({
                    facebookId: profile.id,
                    name: profile.displayName,
                    email: profile.emails ? profile.emails[0].value : ''
                }).save();
                done(null, newUser);
            } catch (err) {
                done(err, null);
            }
        }
    ));
} else {
    console.warn('⚠️ Facebook App ID is missing or placeholder. Facebook Login will not work.');
}



// 4. Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test1.html'));
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/?user=' + encodeURIComponent(req.user.name));
    }
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
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

app.post('/api/products', async (req, res) => {
    try {
        const { name, brand, price, image, category, description, vendorName, condition, warranty } = req.body;
        const newProduct = new Product({
            name, brand, price, image, category, description,
            vendorName, condition, warranty
        });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add product' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// User API
app.get('/api/current_user', (req, res) => {
    res.send(req.user);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
