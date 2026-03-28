const mongoose = require('mongoose');
const Case = require('./models/Case');
const Client = require('./models/Client');
const User = require('./models/User');
require('dotenv').config();

async function checkAllCases() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/justice-core');
    
    const lawyer = await User.findOne({ email: 'sitansu.jena2009@gmail.com' });
    if (!lawyer) {
        console.log('Lawyer not found');
        process.exit(1);
    }
    
    const cases = await Case.find({ lawyer: lawyer._id }).populate('clients', 'email contactPerson');
    console.log('Cases for Lawyer', lawyer.email, ':', cases.length);
    cases.forEach(c => {
      console.log('- Case:', c.caseName);
      console.log('  Clients:', c.clients.map(cl => `${cl.email} (${cl.contactPerson})`));
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAllCases();
