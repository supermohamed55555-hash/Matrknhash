require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function fixUserRole() {
    try {
        console.log('--- Connecting to MongoDB... ---');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- Connected Successfully! ---\n');

        // Search for user Mohamed
        const userName = 'محمد';
        const user = await User.findOne({ name: userName });

        if (user) {
            console.log(`User Found: ${user.name} (${user.email})`);
            console.log(`Current Role: ${user.role}`);

            user.role = 'vendor';
            await user.save();

            console.log(`✅ Success: Role updated to 'vendor' for ${user.name}`);
        } else {
            console.log(`❌ User '${userName}' not found. Please check the name or modify the script with the correct email.`);
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Database Error:', err);
    }
}

fixUserRole();
