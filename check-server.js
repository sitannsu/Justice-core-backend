const axios = require('axios');

async function checkServer() {
  const ports = [3000, 3006];
  const endpoints = [
    '/',
    '/api/auth/register',
    '/api/case',
    '/api/person'
  ];

  console.log('Checking servers...\n');

  for (const port of ports) {
    console.log(`=== Testing port ${port} ===`);
    
    try {
      // Test basic connectivity
      const response = await axios.get(`http://localhost:${port}`, {
        timeout: 3000
      });
      console.log(`✅ Server running on port ${port}`);
      
      // Test endpoints
      for (const endpoint of endpoints) {
        try {
          const endpointResponse = await axios.get(`http://localhost:${port}${endpoint}`, {
            timeout: 3000
          });
          console.log(`  ✅ ${endpoint} - Status: ${endpointResponse.status}`);
        } catch (error) {
          if (error.response) {
            console.log(`  ❌ ${endpoint} - Status: ${error.response.status}`);
          } else {
            console.log(`  ❌ ${endpoint} - ${error.message}`);
          }
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ No server running on port ${port}`);
      } else {
        console.log(`❌ Error on port ${port}: ${error.message}`);
      }
    }
    console.log('');
  }
}

// Test registration on the correct server
async function testRegistration() {
  const ports = [3000, 3006];
  
  for (const port of ports) {
    try {
      console.log(`=== Testing registration on port ${port} ===`);
      
      const userData = {
        email: "test@example.com",
        password: "Test123!",
        firstName: "Test",
        lastName: "User",
        role: "client"
      };

      const response = await axios.post(`http://localhost:${port}/api/auth/register`, userData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      console.log(`✅ Registration successful on port ${port}:`, response.data);
      return port; // Found working server
    } catch (error) {
      console.log(`❌ Registration failed on port ${port}:`, error.response?.data || error.message);
    }
  }
  
  return null;
}

if (require.main === module) {
  checkServer().then(() => {
    return testRegistration();
  }).then((workingPort) => {
    if (workingPort) {
      console.log(`\n🎉 Working server found on port ${workingPort}`);
      console.log(`Use: http://localhost:${workingPort}/api/auth/register for registration`);
      console.log(`Use: http://localhost:${workingPort}/api/auth/login for login`);
    } else {
      console.log('\n❌ No working server found');
      console.log('Make sure to run: npm start or node app.js');
    }
  });
}

module.exports = { checkServer, testRegistration }; 