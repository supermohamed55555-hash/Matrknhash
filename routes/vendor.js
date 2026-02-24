const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { isAuthenticated } = require('./auth');
const logger = require('../utils/logger');

// Vendor-specific Products
router.get('/products', isAuthenticated, async (req, res) => {
    try {
        const products = await Product.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
        res.json(products);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Vendor-specific Orders
router.get('/orders', isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find({ 'items.vendorId': req.user._id.toString() }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Update Order Status (Vendor access)
router.patch('/orders/:id/status', isAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Not found' });

        const isVendorOrder = order.items.some(item => item.vendorId === req.user._id.toString());
        if (!isVendorOrder) return res.status(403).json({ error: 'Forbidden' });

        order.status = status;
        await order.save();

        const connectedUsers = req.app.get('connectedUsers');
        const customerSocketId = connectedUsers.get(order.user.toString());
        if (customerSocketId) {
            req.app.get('io').to(customerSocketId).emit('new_order', {
                message: `تحديث لطلبك #${order._id.substring(18)}: الحالة أصبحت الآن [${status}]`,
                orderId: order._id,
                status: status
            });
        }
        res.json({ success: true, status: order.status });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
