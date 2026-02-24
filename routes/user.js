const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const { isAuthenticated } = require('./auth');
const logger = require('../utils/logger');

// Address Management
router.get('/addresses', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user.addresses || []);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/addresses', isAuthenticated, async (req, res) => {
    try {
        const { label, details, isDefault } = req.body;
        const user = await User.findById(req.user._id);
        if (isDefault) user.addresses.forEach(addr => addr.isDefault = false);
        user.addresses.push({ label, details, isDefault });
        await user.save();
        res.status(201).json(user.addresses);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/addresses/:id', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Wallet balance
router.get('/wallet', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ balance: user.walletBalance || 0 });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Returns list
router.get('/returns', isAuthenticated, async (req, res) => {
    try {
        const returns = await Order.find({ user: req.user._id, returnStatus: { $ne: null } }).sort({ createdAt: -1 });
        res.json(returns);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Garage Management
router.get('/garage', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user.garage || []);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/garage', isAuthenticated, async (req, res) => {
    try {
        const { make, model, year, engine } = req.body;
        const user = await User.findById(req.user._id);
        const isPrimary = (user.garage || []).length === 0;
        user.garage.push({ make, model, year, engine, isPrimary });
        await user.save();
        res.status(201).json(user.garage);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/garage/:carId', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.garage = user.garage.filter(car => car._id.toString() !== req.params.carId);
        await user.save();
        res.json({ message: 'Car removed', garage: user.garage });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.patch('/garage/:carId/primary', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.garage.forEach(car => car.isPrimary = (car._id.toString() === req.params.carId));
        await user.save();
        res.json(user.garage);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
