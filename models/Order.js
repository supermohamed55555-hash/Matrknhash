const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        priceAtPurchase: { type: Number, required: true },
        image: { type: String },
        quantity: { type: Number, default: 1 },
        vendorId: { type: String } // Future ref to Vendor
    }],
    totalPrice: { type: Number, required: true },
    shippingAddress: {
        governorate: String,
        city: String,
        street: String,
        building: String,
        phone: String
    },
    paymentMethod: { type: String, default: 'Wallet' },
    status: { type: String, default: 'Pending' }, // Pending, Processing, Shipped, Delivered, Cancelled
    returnStatus: { type: String, enum: [null, 'Requested', 'Approved', 'Rejected'], default: null },
    returnReason: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
