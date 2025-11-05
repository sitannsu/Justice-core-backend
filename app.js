require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const personRoutes = require('./routes/person');
const caseRoutes = require('./routes/case');
const clientRoutes = require('./routes/client');
const aiRoutes = require('./routes/ai');
const eventRoutes = require('./routes/event');
const taskRoutes = require('./routes/task');
const invoiceRoutes = require('./routes/invoice');
const locationRoutes = require('./routes/location');
const intervalRoutes = require('./routes/interval');
const dashboardRoutes = require('./routes/dashboard');
const clientAuthRoutes = require('./routes/clientAuth');
const documentRoutes = require('./routes/document');
const folderRoutes = require('./routes/folder');
const timeTrackingRoutes = require('./routes/timeTracking');
const attorneyRoutes = require('./routes/attorney');
const caseActivityRoutes = require('./routes/caseActivity');
const intakeRoutes = require('./routes/intake');
const researchRoutes = require('./routes/research');
const voiceMemoRoutes = require('./routes/voiceMemo');
const documentAutomationRoutes = require('./routes/documentAutomation');
const chatRoutes = require('./routes/chat');
const contractRoutes = require('./routes/contract');
const googleCalendarRoutes = require('./routes/googleCalendar');
const paymentsRoutes = require('./routes/payments');
const invoiceClientRoutes = require('./routes/invoice');
const departmentRoutes = require('./routes/department');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/case', caseRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/interval', intervalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/client/auth', clientAuthRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/time-tracking', timeTrackingRoutes);
app.use('/api/attorneys', attorneyRoutes);
app.use('/api/case-activities', caseActivityRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/voice-memos', voiceMemoRoutes);
app.use('/api', documentAutomationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/invoices', invoiceClientRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api', aiRoutes);


// Basic health check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({ 
    status: 'OK', 
    service: 'Justice Core Backend',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Detailed database health check
app.get('/health/db', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    
    res.status(200).json({ 
      database: 'connected',
      timestamp: new Date().toISOString(),
      details: {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      }
    });
  } catch (error) {
    res.status(503).json({ 
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Justice Core Backend is running in Docker! 🐳',
    timestamp: new Date().toISOString(),
    success: true
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});


//DB CONNECTION WITH RETRY LOGIC
const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');
  
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4, 
    retryWrites: true,
    maxPoolSize: 10
  })
  .then(() => {
    console.log(' Connected to MongoDB successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(` Connection: ${mongoose.connection.host}:${mongoose.connection.port}`);
  })
  .catch(err => {
    console.error(' MongoDB connection error:', err.message);
    console.log(' Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

// Start the connection
connectWithRetry();

// MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log(' MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(' MongoDB connection error:', err);
});

// Start server
const PORT = process.env.PORT || 3006;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(' Justice Core Backend Server Started');
    console.log('='.repeat(50));
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/health`);
    console.log(` DB Health: http://localhost:${PORT}/health/db`);
    console.log(` Test endpoint: http://localhost:${PORT}/api/test`);
    console.log('='.repeat(50));
  });
}

module.exports = app;