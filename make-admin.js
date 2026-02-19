const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.MONGO_URI) {
    require('dotenv').config(); // Try current directory as fallback
}

const mongoose = require('mongoose');
const User = require('./models/User');

async function makeAdmin() {
    try {
        console.log('--- Connecting to MongoDB... ---');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- Connected Successfully! ---\n');

        // Use email for precision
        const identifier = { email: 'supermohamed55555@gmail.com' };
        const user = await User.findOne(identifier);

        if (user) {
            console.log(`User Found: ${user.name} (${user.email})`);
            user.role = 'admin';
            user.status = 'active'; // Ensure admin is active
            await user.save();
            console.log(`✅ Success: ${user.name} is now a SUPER ADMIN! 👑`);
        } else {
            console.log(`❌ User not found with:`, identifier);
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Database Error:', err);
    }
}

makeAdmin();
