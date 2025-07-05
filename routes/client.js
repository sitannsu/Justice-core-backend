const express = require('express');
const router = express.Router();
const clientAuth = require('../middleware/clientAuth');
const Client = require('../models/Client');
const Case = require('../models/Case');

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

module.exports = router;
