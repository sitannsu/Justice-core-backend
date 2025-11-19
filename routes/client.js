const express = require('express');
const router = express.Router();
const clientAuth = require('../middleware/clientAuth');
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const Case = require('../models/Case');
const mongoose = require('mongoose');

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
      lawyer: req.user.userId || req.user.id,
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

    // Send welcome / verification email to the client (non-blocking for main flow)
    try {
      const { emailService } = await import('../services/email.service.js');

      const portalUrl = `${process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:8083'}/client/login`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Docket</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f8f9fa; }
            .button { display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .code { background: #eee; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Docket</h1>
            </div>
            <div class="content">
              <h2>Hello ${contactPerson || ''},</h2>
              <p>You have been added as a client by your lawyer in the Docket platform.</p>
              <p>You can access your client portal and verify your account by logging in with the details below:</p>
              <p>
                <strong>Login Email:</strong> <span class="code">${email}</span><br/>
                <strong>Temporary Password:</strong> <span class="code">Password123</span>
              </p>
              <p>Click the button below to open your client portal:</p>
              <p>
                <a href="${portalUrl}" class="button">Go to Client Portal</a>
              </p>
              <p>If the button does not work, copy and paste this link into your browser:</p>
              <p class="code">${portalUrl}</p>
              <p>For security, we recommend that you log in and change your password after your first sign-in.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Docket. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: email,
        subject: 'You have been added as a client on Docket',
        html
      });
    } catch (emailError) {
      console.error('Error sending client welcome email:', emailError);
    }

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
    console.log('--- [GET /api/client/profile] ---');
    console.log('Client token user:', req.user);
    const client = await Client.findById(req.user.id).select('-password');
    if (!client) {
      console.log('Client not found for id:', req.user.id);
      return res.status(404).json({ message: 'Client not found' });
    }
    console.log('Fetched client:', {
      _id: client._id,
      email: client.email,
      company: client.company,
      contactPerson: client.contactPerson
    });
    res.json(client);
  } catch (error) {
    console.log('Error fetching client profile:', error);
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
    console.log('--- [GET /api/client/cases] ---');
    console.log('Client token user:', req.user);
    const query = {
      clients: new mongoose.Types.ObjectId(req.user.id),
      status: { $ne: 'closed' }
    };
    console.log('Case query:', query);

    // Search for cases where this client ID is in the clients array
    const cases = await Case.find(query)
      .populate('lawyer', 'firstName lastName')
      .populate('clients', 'company contactPerson email')
      .sort({ dateOpened: -1 });

    console.log('Found cases count:', cases.length);
    if (cases.length > 0) {
      cases.forEach((c, i) => {
        console.log(`  Case[${i}]:`, {
          _id: c._id,
          caseName: c.caseName,
          clients: c.clients.map(cl => cl._id.toString())
        });
      });
    }

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

// Get single case details for client
router.get('/cases/:caseId', clientAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    if (!caseId) {
      return res.status(400).json({ message: 'caseId is required' });
    }

    console.log('--- [GET /api/client/cases/:caseId] ---');
    console.log('Client token user:', req.user);

    const caseDoc = await Case.findOne({
      _id: caseId,
      clients: new mongoose.Types.ObjectId(clientId)
    })
      .populate('lawyer', 'firstName lastName email phoneNumber')
      .populate('clients', 'company contactPerson email phone');

    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found for this client' });
    }

    // Find this client within the case's clients list
    const clientInCase = (caseDoc.clients || []).find(c => c._id.toString() === clientId);

    const formattedCase = {
      id: caseDoc._id,
      caseName: caseDoc.caseName,
      caseNumber: caseDoc.caseNumber,
      status: caseDoc.status || 'Active',
      priority: 'Medium',
      caseType: caseDoc.practiceArea || 'General',
      description: caseDoc.description || '',
      assignedLawyer: caseDoc.lawyer
        ? {
            name: `${caseDoc.lawyer.firstName || ''} ${caseDoc.lawyer.lastName || ''}`.trim() || 'Your Lawyer',
            email: caseDoc.lawyer.email || '',
            phone: caseDoc.lawyer.phoneNumber || ''
          }
        : null,
      client: clientInCase
        ? {
            name: clientInCase.contactPerson || clientInCase.company || '',
            email: clientInCase.email || '',
            phone: clientInCase.phone || ''
          }
        : null,
      createdAt: caseDoc.createdAt,
      updatedAt: caseDoc.updatedAt,
      estimatedCompletion: caseDoc.statuteOfLimitations || null,
      fees: caseDoc.caseValue || 0,
      progress: 0,
      activities: [],
      documents: []
    };

    return res.json({ case: formattedCase });
  } catch (error) {
    console.error('Error fetching client case details:', error);
    return res.status(500).json({ message: error.message });
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
    const clients = await Client.find({})
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
