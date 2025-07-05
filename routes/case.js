const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const authMiddleware = require('../middleware/auth');

// Create a new case
router.post('/', authMiddleware, async (req, res) => {
  try {
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
      customFields
    } = req.body;

    const newCase = new Case({
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
      customFields,
      lawyer: req.user.userId
    });

    await newCase.save();

    // Populate the references
    const populatedCase = await Case.findById(newCase._id)
      .populate('clients', 'firstName lastName email')
      .populate('contacts', 'firstName lastName email')
      .populate('staff', 'firstName lastName email')
      .populate('lawyer', 'firstName lastName email');

    res.status(201).json(populatedCase);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Case number must be unique' });
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
      .sort({ createdAt: -1 });

    res.json(cases);
  } catch (error) {
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
