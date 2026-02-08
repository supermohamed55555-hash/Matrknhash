const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  password: { type: String }, // Optional if using Google/FB
  googleId: { type: String },
  facebookId: { type: String },
  role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
  phone: { type: String },
  shopName: { type: String }, // For Vendors
  location: { type: String }, // For Vendors
  addresses: [{
    label: String, // e.g., المنزل، المكتب
    details: String,
    isDefault: { type: Boolean, default: false }
  }],
  walletBalance: { type: Number, default: 0 },
  garage: [{
    make: String, // e.g., Toyota
    model: String, // e.g., Corolla
    year: String,
    engine: String,
    isPrimary: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
