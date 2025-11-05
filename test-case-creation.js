const axios = require('axios');

const BASE_URL = 'http://localhost:3006';

async function testCaseCreation() {
  try {
    console.log('=== Testing Case Creation ===');
    
    // First, login to get a token
    const loginData = {
      email: "law2@yopmail.com",
      password: "Qwerty12@"
    };

    console.log('Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Test case creation with corrected data
    const caseData = {
      caseName: "Test Case",
      caseNumber: "TEST-001",
      practiceArea: "employment",
      caseStage: "transactional",
      dateOpened: "2025-07-03",
      office: "Main Office", // Now required field
      description: "Test case description",
      statuteOfLimitations: "2025-08-01",
      clients: ["688a3a5ff6bf60936c12c998"],
      customFields: {
        priority: "medium",
        caseValue: "222",
        attorney: "",
        paralegal: "",
        billableRate: "222",
        tags: [], // Now allowed as array
        team: []  // Now allowed as array
      },
      status: "Active"
    };

    console.log('\nCreating case with data:', JSON.stringify(caseData, null, 2));

    const caseResponse = await axios.post(`${BASE_URL}/api/case`, caseData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Case creation successful!');
    console.log('Case ID:', caseResponse.data._id);
    console.log('Case Name:', caseResponse.data.caseName);

    // Test getting all cases
    console.log('\n=== Testing Get Cases ===');
    const casesResponse = await axios.get(`${BASE_URL}/api/case`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Get cases successful!');
    console.log('Total cases:', casesResponse.data.length);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

if (require.main === module) {
  testCaseCreation();
}

module.exports = { testCaseCreation }; 