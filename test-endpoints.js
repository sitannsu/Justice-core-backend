const axios = require('axios');

const BASE_URL = 'http://localhost:3006';

async function testEndpoints() {
  const endpoints = [
    '/',
    '/api/auth/register',
    '/api/auth/login',
    '/api/case',
    '/api/persons',
    '/api/client',
    '/api/api/case', // This is the problematic one
    '/api/users',
    '/api/auth'
  ];

  console.log('Testing endpoints on:', BASE_URL);
  console.log('='.repeat(50));

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint}`);
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 5000
      });
      console.log(`✅ ${endpoint} - Status: ${response.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint} - Status: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint} - Connection refused (server not running)`);
      } else {
        console.log(`❌ ${endpoint} - ${error.message}`);
      }
    }
  }
}

// Test registration with proper JSON
async function testRegistration() {
  try {
    console.log('\n=== Testing Registration ===');
    const userData = {
      email: "test@example.com",
      password: "Test123!",
      firstName: "Test",
      lastName: "User",
      role: "client"
    };

    const response = await axios.post(`${BASE_URL}/api/auth/register`, userData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Registration successful:', response.data);
  } catch (error) {
    console.log('❌ Registration failed:', error.response?.data || error.message);
  }
}

if (require.main === module) {
  testEndpoints().then(() => {
    return testRegistration();
  });
}

module.exports = { testEndpoints, testRegistration }; 