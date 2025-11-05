const axios = require('axios');

const API_BASE_URL = 'http://localhost:3006/api';

async function testRegistration() {
  try {
    const userData = {
      email: "law1@yopmail.com",
      password: "Qwerty12@",
      firstName: "sitansu",
      lastName: "Sekhar",
      role: "lawyer",
      phoneNumber: "08971658827",
      firmName: "sitansu",
      zipCode: "",
      numberOfEmployees: 1
    };

    console.log('Testing registration with data:', JSON.stringify(userData, null, 2));

    const response = await axios.post(`${API_BASE_URL}/auth/register`, userData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Registration successful!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('Registration failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function testLogin() {
  try {
    const loginData = {
      email: "law1@yopmail.com",
      password: "Qwerty12@"
    };

    console.log('\nTesting login with data:', JSON.stringify(loginData, null, 2));

    const response = await axios.post(`${API_BASE_URL}/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Login successful!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('Login failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('=== Testing Registration ===');
  await testRegistration();
  
  console.log('\n=== Testing Login ===');
  await testLogin();
}

if (require.main === module) {
  runTests();
}

module.exports = { testRegistration, testLogin }; 