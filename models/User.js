const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  password: { type: String },
  googleId: { type: String },
  facebookId: { type: String },
  role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
  phone: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
