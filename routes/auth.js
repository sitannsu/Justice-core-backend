const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client');
const auth = require('../middleware/auth');
const { emailService } = require('../services/email.service');
const crypto = require('crypto');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, firmName, numberOfEmployees, phoneNumber } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Validate lawyer-specific fields
    if (role === 'lawyer' && (!firmName || !numberOfEmployees)) {
      return res.status(400).json({ message: 'Firm name and number of employees are required for lawyers' });
    }

    // Check if user already exists
    console.log('Checking for existing user with email:', email);
    const existingUser = await User.findOne({ email });
    console.log('Database query result:', existingUser);
    if (existingUser) {
      console.log('Found existing user:', { userId: existingUser._id, userEmail: existingUser.email });
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate confirmation token for lawyers
    const confirmationToken = role === 'lawyer' ? crypto.randomBytes(32).toString('hex') : undefined;
    const confirmationTokenExpires = role === 'lawyer' ? Date.now() + 24 * 60 * 60 * 1000 : undefined; // 24 hours

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: role || 'client',
      firmName,
      numberOfEmployees,
      phoneNumber,
      isConfirmed: role !== 'lawyer', // Only lawyers need confirmation
      confirmationToken,
      confirmationTokenExpires,
      zipCode: req.body.zipCode || ''
    });

    // Save user
    await user.save();

    // Send verification email for lawyers
    if (role === 'lawyer') {
      try {
        await emailService.sendVerificationEmail(user.email, confirmationToken, user.firstName);
        console.log(`Verification email sent to ${user.email}`);
      } catch (err) {
        console.error('Failed to send verification email:', err);
      }
    }

    // For non-lawyer roles, generate JWT token for auto-login
    let token = undefined;
    if (user.role !== 'lawyer') {
      token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
    }

    // Return response
    res.status(201).json({
      message: user.role === 'lawyer' 
        ? 'Registration successful! Please check your email to confirm your account.' 
        : 'Registration successful!',
      token,
      requiresConfirmation: user.role === 'lawyer',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        firmName: user.firmName,
        numberOfEmployees: user.numberOfEmployees,
        phoneNumber: user.phoneNumber,
        zipCode: user.zipCode
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Unified Login for User and Client
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Try User model first
    let user = await User.findOne({ email });
    let isClient = false;
    if (user) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if email is confirmed for lawyers (skip if admin or other roles)
      if (user.role === 'lawyer' && user.isConfirmed === false) {
        return res.status(403).json({ 
          message: 'Please confirm your email address before logging in.', 
          requiresConfirmation: true 
        });
      }
    } else {
      // Try Client model
      user = await Client.findOne({ email });
      isClient = true;
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check if client has completed onboarding
      if (user.isOnboarded === false) {
        return res.status(403).json({ 
          message: 'Please complete your account setup via the onboarding email sent to you.',
          requiresOnboarding: true 
        });
      }
    }

    // Standardize payload: always id, email, role
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || (isClient ? 'client' : undefined) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Standardize user response
    let userResponse;
    if (isClient) {
      userResponse = {
        id: user._id,
        email: user.email,
        contactPerson: user.contactPerson,
        company: user.company,
        role: 'client',
        accountType: user.accountType,
        status: user.status
      };
    } else {
      userResponse = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        firmName: user.firmName,
        numberOfEmployees: user.numberOfEmployees,
        phoneNumber: user.phoneNumber,
        zipCode: user.zipCode
      };
    }

    res.json({ token, user: userResponse });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Client login
router.post('/client-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find client
    const client = await Client.findOne({ email });
    if (!client) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password using the Client model's comparePassword method
    const isMatch = await client.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if client has completed onboarding
    if (client.isOnboarded === false) {
      return res.status(403).json({ 
        message: 'Please complete your account setup via the onboarding email sent to you.',
        requiresOnboarding: true 
      });
    }

    // Generate token for client
    const token = jwt.sign(
      { id: client._id, clientId: client._id, email: client.email, role: 'client' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      client: {
        id: client._id,
        email: client.email,
        contactPerson: client.contactPerson,
        company: client.company,
        role: 'client'
      }
    });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ message: 'Server error during client login' });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      firmName: user.firmName,
      numberOfEmployees: user.numberOfEmployees,
      phoneNumber: user.phoneNumber
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, firmName, numberOfEmployees, phoneNumber } = req.body;
    const updateData = {};

    // Only update provided fields
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (firmName) updateData.firmName = firmName;
    if (numberOfEmployees) updateData.numberOfEmployees = numberOfEmployees;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      firmName: user.firmName,
      numberOfEmployees: user.numberOfEmployees,
      phoneNumber: user.phoneNumber
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

// Request password reset
router.post('/password-reset-request', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // TODO: Send reset email with token
    // For now, just return success message
    res.json({ message: 'Password reset instructions sent to email' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
});

// Update password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password using the User model's comparePassword method
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password (will be hashed automatically by the User model)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'Server error during password update' });
  }
});

// Verify email address
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ 
      confirmationToken: token, 
      confirmationTokenExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ message: 'Confirmation token is invalid or has expired.' });
    }

    user.isConfirmed = true;
    user.confirmationToken = undefined;
    user.confirmationTokenExpires = undefined;
    await user.save();

    // Redirect to frontend with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(`${frontendUrl}/auth?verified=true`);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

module.exports = router;
