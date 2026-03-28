const mongoose = require('mongoose');
const Client = require('./models/Client');
const Case = require('./models/Case');
require('dotenv').config();

async function checkCases() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/justice-core');
    
    const client = await Client.findOne({ email: 'sitansu.jena2011@gmail.com' });
    if (!client) {
      console.log('Client sitansu.jena2011@gmail.com not found');
      process.exit(1);
    }
    
    console.log('Found Client:', client.email, 'ID:', client._id);
    console.log('Is Onboarded:', client.isOnboarded);
    console.log('Contact Person:', client.contactPerson);
    
    const casesCount = await Case.countDocuments({ clients: client._id });
    console.log('Cases Count:', casesCount);
    
    if (casesCount > 0) {
      const cases = await Case.find({ clients: client._id });
      cases.forEach(c => {
        console.log('- Case Name:', c.caseName, 'Status:', c.status);
      });
    } else {
        // Look for any cases at all to see if IDs match
        const allCases = await Case.find({}).limit(5);
        console.log('Sample cases in DB:');
        allCases.forEach(c => {
          console.log('- ', c.caseName, 'Clients:', c.clients);
        });
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCases();
