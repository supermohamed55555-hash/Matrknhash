const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.MONGO_URI) {
    require('dotenv').config();
}

const mongoose = require('mongoose');
const User = require('./models/User');

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({}, 'name email role');

        console.log('\n--- القائمة الحالية للمستخدمين ---');
        if (users.length === 0) {
            console.log('لا يوجد مستخدمين مسجلين حالياً.');
        } else {
            users.forEach(u => {
                console.log(`- الاسم: ${u.name} | الإيميل: ${u.email} | الرتبة: ${u.role}`);
            });
        }
        console.log('\n----------------------------------');

        mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

listUsers();
