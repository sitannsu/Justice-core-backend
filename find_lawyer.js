const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function findUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/justice-core');
    const users = await User.find({ role: 'lawyer' }).limit(5);
    console.log('Lawyers in DB:');
    users.forEach(u => {
      console.log('- Email:', u.email, 'Role:', u.role);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findUser();
