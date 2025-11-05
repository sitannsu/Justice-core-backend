const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(cors({
  origin: ['http://localhost:3006', 'http://192.168.1.122:3006', 'http://192.168.1.122:3006', 'http://localhost:3006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://sitansu:Flutter2023@cluster0.bquvjkf.mongodb.net/JusticeCore';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Import routes
const personRoutes = require('./routes/person');
const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/case');
const invoiceRoutes = require('./routes/invoice');
const taskRoutes = require('./routes/task');
const documentRoutes = require('./routes/document');
const eventRoutes = require('./routes/event');
const googleCalendarRoutes = require('./routes/googleCalendar');
const dashboardRoutes = require('./routes/dashboard');
const clientAuthRoutes = require('./routes/clientAuth');
const clientRoutes = require('./routes/client');
const locationRoutes = require('./routes/location');
const intervalRoutes = require('./routes/interval');
const voiceMemoRoutes = require('./routes/voiceMemo');
const automationRoutes = require('./routes/automation');
const documentAutomationRoutes = require('./routes/documentAutomation');
const chatRoutes = require('./routes/chat');

const User = require('./models/User');

// Auth Middleware
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, firmName, numberOfEmployees, phoneNumber } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: 'lawyer',
      firmName,
      numberOfEmployees,
      phoneNumber
    });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!' });
});

// Use routes
app.use('/api/person', personRoutes);
app.use('/api/case', caseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/client/auth', clientAuthRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/interval', intervalRoutes);
app.use('/api/voice-memos', voiceMemoRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api', documentAutomationRoutes);
app.use('/api/chat', chatRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});