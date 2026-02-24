require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const emailToPromote = 'الايميل_الجديد@gmail.com'; // <--- غير ده لإيميل الشخص

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ متصل بقاعدة البيانات...');

        const user = await User.findOne({ email: emailToPromote });

        if (!user) {
            console.error('❌ المستخدم ده مش موجود أصلاً، خليه يسجل في الموقع الأول!');
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();

        console.log(`\n🎉 مبروك! المستخدم ${user.name} بقا "أدمن" دلوقتي.`);
        console.log('يقدر يدخل دلوقتي على لوحة المدير العام من: /super-admin.html\n');

        process.exit(0);
    })
    .catch(err => {
        console.error('❌ خطأ:', err);
        process.exit(1);
    });
