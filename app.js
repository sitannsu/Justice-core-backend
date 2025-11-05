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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
