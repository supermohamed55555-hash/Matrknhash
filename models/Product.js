const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true }, // URL of the image
    category: { type: String, enum: ['Wheels', 'Tires', 'Accessories'], default: 'Wheels' },
    description: { type: String },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendorName: { type: String }, // Cache vendor name for display
    condition: { type: String, default: "جديد" },
    warranty: { type: String, default: "لا يوجد" },
    stockQuantity: { type: Number, default: 0 },
    tags: [String],
    compatibility: [{
        brand: String,
        model: String,
        yearStart: Number,
        yearEnd: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
