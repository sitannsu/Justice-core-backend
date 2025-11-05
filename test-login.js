const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

// Connect to MongoDB (update with your connection string)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name';

async function testLogin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test credentials
    const testEmail = 'test@example.com';
    const testPassword = 'password123';

    // Find user
    const user = await User.findOne({ email: testEmail });
    if (!user) {
      console.log('User not found. Please register a user first.');
      return;
    }

    console.log('Found user:', {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    // Test password comparison
    console.log('\nTesting password comparison...');
    const isMatch = await user.comparePassword(testPassword);
    console.log('Password match:', isMatch);

    // Test with bcrypt directly
    const directMatch = await bcrypt.compare(testPassword, user.password);
    console.log('Direct bcrypt match:', directMatch);

    // Check if password might be double-hashed
    console.log('\nPassword hash analysis:');
    console.log('Password length:', user.password.length);
    console.log('Password starts with $2b$:', user.password.startsWith('$2b$'));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

async function resetUserPassword(email, newPassword) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return;
    }

    // Reset password (will be hashed by the model)
    user.password = newPassword;
    await user.save();

    console.log('Password reset successfully for:', email);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the test
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'reset' && args[1] && args[2]) {
    // Usage: node test-login.js reset email@example.com newpassword
    resetUserPassword(args[1], args[2]);
  } else {
    testLogin();
  }
}

module.exports = { testLogin, resetUserPassword }; 