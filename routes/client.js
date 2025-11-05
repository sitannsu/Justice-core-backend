const express = require('express');
const router = express.Router();
const clientAuth = require('../middleware/clientAuth');
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const Case = require('../models/Case');

// Create a new client
router.post('/', auth, async (req, res) => {
  try {
    const { company, contactPerson, email, phone, address, accountType, status, notes } = req.body;

    // Check if client already exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ 
        message: 'Client with this email already exists',
        existingClient: {
          _id: existingClient._id,
          email: existingClient.email,
          contactPerson: existingClient.contactPerson
        }
      });
    }

    // Create new client with default password
    const client = new Client({
      lawyer: req.user.userId, 
      company,
      contactPerson,
      email,
      phone,
      address,
      accountType,
      status: status || 'Active',
      notes,
      password: 'Password123' // Default password for client login
    });

    await client.save();

    res.status(201).json({
      _id: client._id,
      company: client.company,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      address: client.address,
      accountType: client.accountType,
      status: client.status,
      casesCount: 0,
      totalValue: 0,
      lastContact: client.createdAt,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      message: 'Client created successfully with default password "Password123". Client can login using their email and this password.'
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get client profile
router.get('/profile', clientAuth, async (req, res) => {
  try {
    const client = await Client.findById(req.user.clientId).select('-password');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update client profile
router.put('/profile', clientAuth, async (req, res) => {
  try {
    const { company, contactPerson, email, accountType } = req.body;
    const client = await Client.findById(req.user.clientId);
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (company) client.company = company;
    if (contactPerson) client.contactPerson = contactPerson;
    if (email) client.email = email;
    if (accountType) client.accountType = accountType;

    await client.save();
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get client cases
router.get('/cases', clientAuth, async (req, res) => {
  try {
    console.log('Client token user:', req.user);

    // Search for cases where this client ID is in the clients array
    const cases = await Case.find({ 
      clients: req.user.clientId,  // Direct match on client ID
      status: { $ne: 'closed' } // Only get active cases
    })
    .populate('lawyer', 'firstName lastName')
    .populate('clients', 'company contactPerson email')
    .sort({ dateOpened: -1 });

    console.log('Found cases:', cases);

    // Format the case data
    const formattedCases = cases.map(case_ => ({
      _id: case_._id,
      caseName: case_.caseName,
      caseNumber: case_.caseNumber,
      practiceArea: case_.practiceArea,
      caseStage: case_.caseStage,
      dateOpened: case_.dateOpened,
      office: case_.office,
      description: case_.description,
      statuteOfLimitations: case_.statuteOfLimitations,
      status: case_.status,
      lawyer: case_.lawyer ? {
        _id: case_.lawyer._id,
        firstName: case_.lawyer.firstName,
        lastName: case_.lawyer.lastName
      } : null,
      clients: case_.clients.map(client => ({
        _id: client._id,
        company: client.company,
        contactPerson: client.contactPerson,
        email: client.email
      })),
      createdAt: case_.createdAt,
      updatedAt: case_.updatedAt
    }));

    console.log('Formatted cases:', formattedCases);
    res.json(formattedCases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get lawyer profile (for clients to see their lawyer info)
router.get('/lawyer', clientAuth, async (req, res) => {
  try {
    // Find a case that belongs to this client to get the lawyer info
    const caseWithLawyer = await Case.findOne({ 
      clients: req.user.clientId 
    }).populate('lawyer', 'firstName lastName email firmName phoneNumber');

    if (!caseWithLawyer || !caseWithLawyer.lawyer) {
      return res.status(404).json({ message: 'Lawyer not found for this client' });
    }

    res.json({
      lawyer: caseWithLawyer.lawyer,
      firmName: caseWithLawyer.lawyer.firmName,
      contactInfo: {
        email: caseWithLawyer.lawyer.email,
        phone: caseWithLawyer.lawyer.phoneNumber
      }
    });
  } catch (error) {
    console.error('Error fetching lawyer info:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all clients for a lawyer
router.get('/', auth, async (req, res) => {
  try {
    console.log('Getting clients for lawyer:', req.user.userId);
    const clients = await Client.find({ lawyer: req.user.userId })
      .select('-password')
      .sort({ createdAt: -1 });

    console.log('Found clients:', clients.length);

    // Get case counts and total values for each client
    const clientsWithStats = await Promise.all(clients.map(async (client) => {
      const cases = await Case.find({ 
        clients: client._id,
        status: { $ne: 'closed' }
      });

      const totalValue = cases.reduce((sum, c) => sum + (c.caseValue || 0), 0);

      return {
        _id: client._id,
        company: client.company,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        address: client.address,
        accountType: client.accountType,
        status: client.status || 'Active',
        casesCount: cases.length,
        totalValue: totalValue,
        lastContact: client.lastContact || client.updatedAt,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt
      };
    }));

    console.log('Sending clientsWithStats:', clientsWithStats.length);
    res.json(clientsWithStats);
  } catch (error) {
    console.error('Error fetching clients:', error);
    console.error('User from token:', req.user);
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
