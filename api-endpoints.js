const axios = require('axios');

const BASE_URL = 'http://localhost:3006';

// All available API endpoints
const API_ENDPOINTS = {
  // Authentication
  'POST /api/auth/register': 'Register a new user (lawyer/client)',
  'POST /api/auth/login': 'Login user',
  'GET /api/auth/profile': 'Get user profile (requires auth)',
  'PUT /api/auth/profile': 'Update user profile (requires auth)',
  'POST /api/auth/password-reset-request': 'Request password reset',
  'PUT /api/auth/password': 'Update password (requires auth)',

  // Cases
  'GET /api/case': 'Get all cases for logged-in lawyer (requires auth)',
  'POST /api/case': 'Create a new case (requires auth)',
  'GET /api/case/:id': 'Get specific case (requires auth)',
  'PUT /api/case/:id': 'Update case (requires auth)',
  'DELETE /api/case/:id': 'Delete case (requires auth)',

  // Clients
  'GET /api/client': 'Get all clients for logged-in lawyer (requires auth)',
  'POST /api/client': 'Create a new client (requires auth)',
  'GET /api/client/profile': 'Get client profile (requires client auth)',
  'PUT /api/client/profile': 'Update client profile (requires client auth)',
  'GET /api/client/cases': 'Get cases for logged-in client (requires client auth)',

  // Persons
  'GET /api/person': 'Get all persons for logged-in lawyer (requires auth)',
  'POST /api/person': 'Create a new person (requires auth)',
  'GET /api/person/:id': 'Get specific person (requires auth)',
  'PUT /api/person/:id': 'Update person (requires auth)',
  'DELETE /api/person/:id': 'Delete person (requires auth)',

  // Invoices
  'GET /api/invoices': 'Get all invoices (requires auth)',
  'POST /api/invoices': 'Create a new invoice (requires auth)',
  'GET /api/invoices/:id': 'Get specific invoice (requires auth)',
  'PUT /api/invoices/:id': 'Update invoice (requires auth)',
  'DELETE /api/invoices/:id': 'Delete invoice (requires auth)',

  // Tasks
  'GET /api/tasks': 'Get all tasks (requires auth)',
  'POST /api/tasks': 'Create a new task (requires auth)',
  'GET /api/tasks/:id': 'Get specific task (requires auth)',
  'PUT /api/tasks/:id': 'Update task (requires auth)',
  'DELETE /api/tasks/:id': 'Delete task (requires auth)',

  // Events
  'GET /api/events': 'Get all events (requires auth)',
  'POST /api/events': 'Create a new event (requires auth)',
  'GET /api/events/:id': 'Get specific event (requires auth)',
  'PUT /api/events/:id': 'Update event (requires auth)',
  'DELETE /api/events/:id': 'Delete event (requires auth)',

  // Dashboard
  'GET /api/dashboard': 'Get dashboard data (requires auth)',

  // Location
  'GET /api/location': 'Get all locations (requires auth)',
  'POST /api/location': 'Create a new location (requires auth)',
  'GET /api/location/:id': 'Get specific location (requires auth)',
  'PUT /api/location/:id': 'Update location (requires auth)',
  'DELETE /api/location/:id': 'Delete location (requires auth)',

  // Interval
  'GET /api/interval': 'Get all intervals (requires auth)',
  'POST /api/interval': 'Create a new interval (requires auth)',
  'GET /api/interval/:id': 'Get specific interval (requires auth)',
  'PUT /api/interval/:id': 'Update interval (requires auth)',
  'DELETE /api/interval/:id': 'Delete interval (requires auth)',

  // Google Calendar
  'GET /api/google-calendar': 'Get Google Calendar integration (requires auth)',
  'POST /api/google-calendar': 'Setup Google Calendar (requires auth)',

  // Client Auth
  'POST /api/client/auth/login': 'Client login',
  'POST /api/client/auth/register': 'Client registration'
};

function showAllEndpoints() {
  console.log('=== Available API Endpoints ===');
  console.log(`Base URL: ${BASE_URL}\n`);
  
  Object.entries(API_ENDPOINTS).forEach(([endpoint, description]) => {
    console.log(`${endpoint}`);
    console.log(`  ${description}`);
    console.log(`  Full URL: ${BASE_URL}${endpoint.split(' ')[1]}\n`);
  });
}

// Test specific endpoints
async function testEndpoints() {
  console.log('=== Testing Key Endpoints ===\n');

  const endpointsToTest = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/case',
    '/api/client',
    '/api/person',
    '/api/invoices',
    '/api/tasks',
    '/api/events',
    '/api/dashboard'
  ];

  for (const endpoint of endpointsToTest) {
    try {
      console.log(`Testing: ${endpoint}`);
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 3000
      });
      console.log(`  ✅ Status: ${response.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`  ❌ Status: ${error.response.status} - ${error.response.statusText}`);
      } else {
        console.log(`  ❌ ${error.message}`);
      }
    }
  }
}

// Check if a specific endpoint exists
async function checkEndpoint(endpoint) {
  try {
    console.log(`Checking endpoint: ${endpoint}`);
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      timeout: 3000
    });
    console.log(`✅ ${endpoint} exists - Status: ${response.status}`);
    return true;
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${endpoint} - Status: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.log(`❌ ${endpoint} - ${error.message}`);
    }
    return false;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'test') {
    testEndpoints();
  } else if (args[0] === 'check' && args[1]) {
    checkEndpoint(args[1]);
  } else {
    showAllEndpoints();
    console.log('\n=== Usage ===');
    console.log('node api-endpoints.js                    - Show all endpoints');
    console.log('node api-endpoints.js test              - Test key endpoints');
    console.log('node api-endpoints.js check /api/client - Check specific endpoint');
  }
}

module.exports = { showAllEndpoints, testEndpoints, checkEndpoint, API_ENDPOINTS }; 