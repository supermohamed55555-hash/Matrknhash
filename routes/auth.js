const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// --- Auth Middleware ---
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Please log in' });
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.email === 'supermohamed55555@gmail.com' || req.user.role === 'admin') {
            return next();
        }
    }
    res.status(403).json({ error: 'Forbidden: Admin access only' });
}

// API: Check Current User
router.get('/current', (req, res) => {
    res.json(req.user || null);
});

// For backward compatibility with some frontend scripts
router.get('/login/success', (req, res) => {
    if (req.user) {
        res.json({ success: true, user: req.user });
    } else {
        res.json({ success: false, message: 'Not authenticated' });
    }
});


// Register
router.post('/register', [
    body('email').isEmail().withMessage('بريد إلكتروني غير صحيح'),
    body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { name, email, password, role, shopName } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'هذا البريد مسجل بالفعل' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'user',
            shopName: role === 'vendor' ? shopName : null
        });

        await newUser.save();
        res.status(201).json({ success: true, message: 'تم التسجيل بنجاح' });
    } catch (err) {
        res.status(500).json({ error: 'فشل عملية التسجيل' });
    }
});

// Login
router.post('/login', (req, res, next) => {
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
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Google Auth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/?user=' + encodeURIComponent(req.user.name));
    }
);

module.exports = {
    router,
    isAuthenticated,
    isAdmin
};
