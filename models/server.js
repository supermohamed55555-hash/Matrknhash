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

const app = express();

// 1. Middleware Setup
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static HTML files
app.use(session({ secret: 'mtrknhash_secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// 2. Database Connection (MongoDB)
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mtrknhashLocalDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Error:', err));

// 3. Authentication Configuration (Passport JS)

// Serialize User
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.findById(id).then(user => done(null, user));
});

// -- Google Strategy --
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        // Check if user exists, else create new
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) return done(null, existingUser);

        const newUser = await new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value
        }).save();
        done(null, newUser);
    }
));

// 4. Routes

// Main Route serves the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test1.html'));
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication
        res.redirect('/?user=' + req.user.name); // Redirect back to home with name
    }
);

// API to check login status
app.get('/api/current_user', (req, res) => {
    res.send(req.user);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
