const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Case = require('../models/Case');
const authMiddleware = require('../middleware/auth');

// Test route to check if JSON parsing is working
router.post('/test', (req, res) => {
  console.log('=== TEST ROUTE CALLED ===');
  console.log('Test route - Request body:', req.body);
  console.log('Test route - Body type:', typeof req.body);
  console.log('Test route - Body keys:', Object.keys(req.body));
  console.log('Test route - Headers:', req.headers);
  console.log('Test route - Content-Type:', req.headers['content-type']);
  res.json({ 
    message: 'Test route working',
    body: req.body,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body),
    headers: req.headers
  });
});

// Create a new case
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('Creating case with data:', req.body);
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request headers:', req.headers);
    console.log('Content-Type header:', req.headers['content-type']);
    console.log('User ID from auth:', req.user.userId);

    // Try to manually parse the body if it's a string
    let bodyData = req.body;
    if (typeof req.body === 'string') {
      try {
        bodyData = JSON.parse(req.body);
        console.log('Manually parsed body:', bodyData);
      } catch (parseError) {
        console.error('Failed to parse body as JSON:', parseError);
        return res.status(400).json({ message: 'Invalid JSON in request body' });
      }
    }

    // Check if bodyData is still empty
    if (!bodyData || Object.keys(bodyData).length === 0) {
      console.error('Request body is empty or invalid');
      return res.status(400).json({ message: 'Request body is empty or invalid' });
    }
    
    const {
      caseName,
      caseNumber,
      practiceArea,
      caseStage,
      dateOpened,
      office,
      description,
      statuteOfLimitations,
      conflictCheck,
      conflictCheckNotes,
      clients,
      contacts,
      staff,
      assignedAttorney,
      customFields
    } = bodyData;

    // Log extracted values
    console.log('Extracted values:', {
      caseName,
      caseNumber,
      practiceArea,
      caseStage,
      dateOpened,
      office,
      description,
      statuteOfLimitations,
      conflictCheck,
      conflictCheckNotes,
      clients,
      contacts,
      staff,
      assignedAttorney,
      customFields
    });

    // Validate required fields
    if (!caseName || !caseName.trim()) {
      return res.status(400).json({ message: 'Case name is required' });
    }
    if (!practiceArea || !practiceArea.trim()) {
      return res.status(400).json({ message: 'Practice area is required' });
    }
    if (!caseStage || !caseStage.trim()) {
      return res.status(400).json({ message: 'Case stage is required' });
    }
    if (!dateOpened) {
      return res.status(400).json({ message: 'Date opened is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }
    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ message: 'At least one client is required' });
    }

    // Validate assignedAttorney if provided
    if (assignedAttorney && !mongoose.Types.ObjectId.isValid(assignedAttorney)) {
      return res.status(400).json({ message: 'Invalid assignedAttorney ID format' });
    }

    const caseData = {
      caseName: caseName.trim(),
      caseNumber: caseNumber ? caseNumber.trim() : undefined,
      practiceArea: practiceArea.trim(),
      caseStage: caseStage.trim(),
      dateOpened: new Date(dateOpened),
      office: office ? office.trim() : '',
      description: description.trim(),
      statuteOfLimitations: statuteOfLimitations ? new Date(statuteOfLimitations) : undefined,
      conflictCheck: conflictCheck || false,
      conflictCheckNotes: conflictCheckNotes ? conflictCheckNotes.trim() : '',
      clients: clients,
      contacts: contacts || [],
      staff: staff || [],
      assignedAttorney: assignedAttorney || undefined,
      customFields: customFields || {},
      lawyer: req.user.userId
    };

    console.log('Case data to be saved:', caseData);

    const newCase = new Case(caseData);

    await newCase.save();

    console.log('Case saved successfully with ID:', newCase._id);

    // Populate the references
    const populatedCase = await Case.findById(newCase._id)
      .populate('clients', 'firstName lastName email')
      .populate('contacts', 'firstName lastName email')
      .populate('staff', 'firstName lastName email')
      .populate('lawyer', 'firstName lastName email')
      .populate('assignedAttorney', 'firstName lastName email specialization');

    console.log('Case populated successfully');
    res.status(201).json(populatedCase);
  } catch (error) {
    console.error('Error creating case:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Case number must be unique' });
    }
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      console.error('Validation error details:', error.errors);
      const validationErrors = Object.keys(error.errors).map(key => 
        `${key}: ${error.errors[key].message}`
      ).join(', ');
      return res.status(400).json({ 
        message: `Validation failed: ${validationErrors}`,
        details: error.errors
      });
    }
    
    res.status(500).json({ message: error.message });
  }
});

// Get all cases for a lawyer
router.get('/', authMiddleware, async (req, res) => {
  try {
    const cases = await Case.find({ lawyer: req.user.userId })
      .populate('clients', 'firstName lastName email')
      .populate('contacts', 'firstName lastName email')
      .populate('staff', 'firstName lastName email')
      .populate('lawyer', 'firstName lastName email')
      .populate('assignedAttorney', 'firstName lastName email specialization')
      .sort({ createdAt: -1 });

    res.json(cases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get cases by client ID
router.get('/client/:clientId', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Find cases where the client is in the clients array
    const cases = await Case.find({ 
      lawyer: req.user.userId,
      clients: clientId 
    })
      .populate('clients', 'firstName lastName email companyName')
      .populate('contacts', 'firstName lastName email')
      .populate('staff', 'firstName lastName email')
      .populate('lawyer', 'firstName lastName email')
      .populate('assignedAttorney', 'firstName lastName email specialization')
      .sort({ createdAt: -1 });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching cases by client:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get a specific case
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const caseItem = await Case.findOne({ 
      _id: req.params.id,
      lawyer: req.user.userId 
    })
      .populate('clients', 'firstName lastName email')
      .populate('contacts', 'firstName lastName email')
      .populate('staff', 'firstName lastName email')
      .populate('lawyer', 'firstName lastName email');

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    res.json(caseItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a case
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const caseItem = await Case.findOne({ 
      _id: req.params.id,
      lawyer: req.user.userId 
    });

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    Object.keys(req.body).forEach(key => {
      caseItem[key] = req.body[key];
    });

    await caseItem.save();

    const updatedCase = await Case.findById(caseItem._id)
      .populate('clients', 'firstName lastName email')
      .populate('contacts', 'firstName lastName email')
      .populate('staff', 'firstName lastName email')
      .populate('lawyer', 'firstName lastName email');

    res.json(updatedCase);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Case number must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete a case
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const caseItem = await Case.findOneAndDelete({ 
      _id: req.params.id,
      lawyer: req.user.userId 
    });

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
