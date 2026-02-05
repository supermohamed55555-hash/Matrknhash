const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true }, // URL of the image
    category: { type: String, enum: ['Wheels', 'Tires', 'Accessories'], default: 'Wheels' },
    description: { type: String },
    vendorName: { type: String, default: "متركنهاش" },
    condition: { type: String, default: "جديد" },
    warranty: { type: String, default: "لا يوجد" },
    compatibility: [{
        brand: String,
        model: String,
        yearStart: Number,
        yearEnd: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
