const mongoose = require('mongoose');
const Client = require('./models/Client');
const Case = require('./models/Case');
const User = require('./models/User');
require('dotenv').config();

async function createTestCase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/justice-core');
    
    const client = await Client.findOne({ email: 'sitansu.jena2011@gmail.com' });
    const lawyer = await User.findOne({ email: 'sitansu.jena2009@gmail.com' });
    
    if (!client || !lawyer) {
      console.log('Client or Lawyer not found');
      process.exit(1);
    }
    
    const newCase = new Case({
      caseName: 'Test Automation Case',
      caseNumber: `AUTO-${Date.now()}`,
      practiceArea: 'Corporate Law',
      caseStage: 'active',
      dateOpened: new Date(),
      description: 'This is a test case created via automation to verify client visibility.',
      lawyer: lawyer._id,
      clients: [client._id],
      status: 'active'
    });
    
    await newCase.save();
    console.log('Test case created:', newCase.caseName, 'vith ID:', newCase._id);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createTestCase();
