const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { isAuthenticated } = require('./auth');
const logger = require('../utils/logger');

// Create Order (Scoped for server.js to pass io/connectedUsers if needed, or emit via events)
// For now, simple router - but we might need event emitter for real-time notifications
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { items, totalPrice, shippingAddress, paymentMethod } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'سلة المشتريات فارغة' });
        }

        const newOrder = new Order({
            user: req.user._id,
            items: items.map(item => ({
                productId: item.productId || item._id,
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

        if (paymentMethod === 'Wallet') {
            const user = await User.findById(req.user._id);
            if (!user || user.walletBalance < totalPrice) {
                return res.status(400).json({ success: false, error: 'رصيد المحفظة غير كافٍ' });
            }
            user.walletBalance -= totalPrice;
            await user.save();
        }

        await newOrder.save();

        // Emit 'orderCreated' for server.js to handle notifications
        req.app.get('io').to('admins').emit('new_order', {
            message: 'طلب جديد على المنصة! 👑',
            orderId: newOrder._id,
            totalPrice: newOrder.totalPrice,
            customerName: req.user.name
        });

        const uniqueVendors = [...new Set(newOrder.items.map(item => item.vendorId))];
        const connectedUsers = req.app.get('connectedUsers');
        uniqueVendors.forEach(vendorId => {
            const socketId = connectedUsers.get(vendorId);
            if (socketId) {
                req.app.get('io').to(socketId).emit('new_order', {
                    message: 'لديك طلب جديد على متركنهاش! 📦',
                    orderId: newOrder._id,
                    totalPrice: newOrder.totalPrice
                });
            }
        });

        res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
        logger.error('CRITICAL ORDER ERROR:', err);
        res.status(500).json({
            success: false,
            error: err.name === 'ValidationError' ? 'بيانات الطلب غير مكتملة' : 'فشل في إتمام الطلب'
        });
    }
});

// Fetch user orders
router.get('/user', isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Return Request
router.post('/:id/return', isAuthenticated, async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        order.returnStatus = 'Requested';
        order.returnReason = reason;
        await order.save();
        res.json({ success: true, message: 'Return requested successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
