const mongoose = require('mongoose');
const Client = require('./models/Client');
require('dotenv').config();

async function checkStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/justice-core');
    const client = await Client.findOne({ email: 'sitansu.jena2009@gmail.com' });
    if (client) {
        console.log('Client:', client.email);
        console.log('Is Onboarded:', client.isOnboarded);
        console.log('Verification Token:', client.verificationToken);
        console.log('Updated At:', client.updatedAt);
    } else {
        console.log('Client not found');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStatus();
