require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Order = require('./models/Order');

async function checkDatabase() {
    try {
        console.log('--- Connecting to MongoDB... ---');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://matrknhash_user:your_password@cluster.mongodb.net/matrknhash');
        console.log('--- Connected Successfully! ---\n');

        const users = await User.find({}, 'name email addresses walletBalance');
        console.log('=== Users & Addresses ===');
        users.forEach(user => {
            console.log(`User: ${user.name} (${user.email})`);
            console.log(`Wallet Balance: ${user.walletBalance} ج.م`);
            console.log(`Addresses (${user.addresses.length}):`);
            user.addresses.forEach((addr, i) => {
                console.log(`  ${i + 1}. [${addr.label}] ${addr.details} ${addr.isDefault ? '(Default)' : ''}`);
            });
            console.log('-------------------------');
        });

        const ordersWithReturns = await Order.find({ returnStatus: { $ne: null } });
        console.log('\n=== Return Requests ===');
        if (ordersWithReturns.length === 0) {
            console.log('No return requests found.');
        } else {
            ordersWithReturns.forEach(order => {
                console.log(`Order: #${order._id.toString().slice(-5)} | Product: ${order.productName}`);
                console.log(`Status: ${order.returnStatus} | Reason: ${order.returnReason}`);
                console.log('-------------------------');
            });
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Database Error:', err);
    }
}

checkDatabase();
