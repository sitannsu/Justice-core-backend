const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Client = require('../models/Client');

// Client Registration
router.post('/register', async (req, res) => {
  try {
    const { company, contactPerson, email, password, accountType } = req.body;

    // Check if client already exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create new client
    const client = new Client({
      company,
      contactPerson,
      email,
      password,
      accountType
    });

    await client.save();

    // Generate JWT token
    const token = jwt.sign(
      { clientId: client._id, email: client.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      client: {
        id: client._id,
        company: client.company,
        contactPerson: client.contactPerson,
        email: client.email,
        accountType: client.accountType
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Client Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find client
    const client = await Client.findOne({ email });
    if (!client) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await client.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { clientId: client._id, email: client.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      client: {
        id: client._id,
        company: client.company,
        contactPerson: client.contactPerson,
        email: client.email,
        accountType: client.accountType
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
