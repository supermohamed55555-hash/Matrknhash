const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const { isAdmin } = require('./auth');
const shippingService = require('../utils/shipping');
const logger = require('../utils/logger');

// Platform Stats
router.get('/stats', isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalVendors = await User.countDocuments({ role: 'vendor' });
        const orders = await Order.find();
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);

        res.json({
            totalUsers, totalVendors,
            totalOrders: orders.length,
            totalRevenue,
            commissionBalance: totalRevenue * 0.1
        });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Vendor Management
router.get('/vendors', isAdmin, async (req, res) => {
    try {
        const vendors = await User.find({ role: 'vendor' }).sort({ createdAt: -1 });
        res.json(vendors);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.patch('/vendors/:id/status', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const vendor = await User.findOneAndUpdate({ _id: req.params.id, role: 'vendor' }, { status }, { new: true });
        res.json(vendor);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Order Management
router.get('/orders', isAdmin, async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/orders/:id/confirm', isAdmin, async (req, res) => {
    try {
        const { carrier } = req.body;
        const order = await Order.findById(req.params.id).populate('user');
        if (!order) return res.status(404).json({ error: 'Not found' });

        order.status = 'Confirmed';
        order.shippingCarrier = carrier || 'Bosta';

        const shippingResult = order.shippingCarrier === 'Bosta'
            ? await shippingService.createBostaShipment(order, order.user)
            : await shippingService.createAramexShipment(order, order.user);

        if (shippingResult.success) {
            order.trackingNumber = shippingResult.trackingNumber;
            order.shippingLabelUrl = shippingResult.labelUrl;
            order.status = 'Shipped';
            await order.save();
            res.json({ success: true, trackingNumber: order.trackingNumber, labelUrl: order.shippingLabelUrl });
        } else {
            throw new Error(shippingResult.error || 'Integration Failed');
        }
    } catch (err) {
        logger.error('Order Confirmation Error:', err);
        res.status(500).json({ error: 'Shipping Error' });
    }
});

router.patch('/orders/:id/status', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Not found' });
        order.status = status;
        await order.save();

        const connectedUsers = req.app.get('connectedUsers');
        const customerSocketId = connectedUsers.get(order.user.toString());
        if (customerSocketId) {
            req.app.get('io').to(customerSocketId).emit('notification', {
                message: `تحديث إداري لطلبك #${order._id.substring(18)}: الحالة الآن [${status}]`,
                orderId: order._id
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
