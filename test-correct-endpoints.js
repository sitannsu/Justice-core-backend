const axios = require('axios');

const BASE_URL = 'http://localhost:3006';

async function testCorrectEndpoints() {
  console.log('Testing correct API endpoints...\n');

  // Test registration
  try {
    console.log('=== Testing Registration ===');
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

    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, userData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Registration successful');
    console.log('Token:', registerResponse.data.token);
    
    const token = registerResponse.data.token;

    // Test login
    console.log('\n=== Testing Login ===');
    const loginData = {
      email: "law1@yopmail.com",
      password: "Qwerty12@"
    };

    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login successful');
    console.log('Token:', loginResponse.data.token);

    // Test cases endpoint with authentication
    console.log('\n=== Testing Cases Endpoint ===');
    const casesResponse = await axios.get(`${BASE_URL}/api/case`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Cases endpoint working');
    console.log('Cases count:', casesResponse.data.length);

    // Test wrong endpoint (the one causing issues)
    console.log('\n=== Testing Wrong Endpoint (for comparison) ===');
    try {
      await axios.get(`${BASE_URL}/api/api/case`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.log('❌ Wrong endpoint failed as expected:', error.response?.status, error.response?.statusText);
    }

  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }
}

// Show correct endpoint URLs
function showCorrectEndpoints() {
  console.log('\n=== Correct API Endpoints ===');
  console.log('Base URL:', BASE_URL);
  console.log('Registration:', `${BASE_URL}/api/auth/register`);
  console.log('Login:', `${BASE_URL}/api/auth/login`);
  console.log('Cases:', `${BASE_URL}/api/case`);
  console.log('Persons:', `${BASE_URL}/api/person`);
  console.log('Invoices:', `${BASE_URL}/api/invoices`);
  console.log('Tasks:', `${BASE_URL}/api/tasks`);
  console.log('Events:', `${BASE_URL}/api/events`);
  console.log('Dashboard:', `${BASE_URL}/api/dashboard`);
  console.log('Location:', `${BASE_URL}/api/location`);
  console.log('Interval:', `${BASE_URL}/api/interval`);
}

if (require.main === module) {
  showCorrectEndpoints();
  testCorrectEndpoints();
}

module.exports = { testCorrectEndpoints, showCorrectEndpoints }; 