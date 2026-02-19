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
        label: String,
        details: String
    },
    paymentMethod: { type: String, default: 'Wallet' },
    status: { type: String, default: 'Pending' }, // Pending, Confirmed, Shipped, Delivered, Cancelled

    // --- Shipping Integration ---
    shippingCarrier: { type: String, enum: ['Bosta', 'Aramex', 'None'], default: 'None' },
    trackingNumber: { type: String },
    shippingLabelUrl: { type: String }, // URL to download/print the PDF
    carrierBookingId: { type: String }, // Internal ID from Bosta/Aramex

    returnStatus: { type: String, enum: [null, 'Requested', 'Approved', 'Rejected'], default: null },
    returnReason: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
