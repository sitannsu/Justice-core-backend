const express = require('express');
const router = express.Router();
const Person = require('../models/Person');
const Case = require('../models/Case');
const authMiddleware = require('../middleware/auth');

// Add a new person
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      peopleGroup,
      enableClientPortal,
      cellPhone,
      workPhone,
      homePhone,
      address
    } = req.body;

    // Create new person with lawyer reference
    const person = new Person({
      firstName,
      middleName,
      lastName,
      email,
      peopleGroup,
      enableClientPortal,
      cellPhone,
      workPhone,
      homePhone,
      address,
      lawyer: req.user.userId
    });

    await person.save();

    // If client portal is enabled, handle welcome email here
    if (enableClientPortal) {
      // TODO: Implement welcome email functionality
    }

    res.status(201).json({
      message: 'Person added successfully',
      person
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error adding person',
      error: error.message
    });
  }
});

// Get all persons for a lawyer
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, search } = req.query;
    const query = { lawyer: req.user.userId };

    // Support filtering by peopleGroup (mapped from 'type' in mobile app)
    if (type && type !== 'undefined' && type !== 'all') {
      query.peopleGroup = type;
    }

    // Support search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const persons = await Person.find(query).sort({ createdAt: -1 });
    res.json(persons);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching persons',
      error: error.message
    });
  }
});

// Get a specific person
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const person = await Person.findOne({
      _id: req.params.id,
      lawyer: req.user.userId
    });

    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.json(person);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching person',
      error: error.message
    });
  }
});

// Update a person
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const person = await Person.findOneAndUpdate(
      { _id: req.params.id, lawyer: req.user.userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.json({
      message: 'Person updated successfully',
      person
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating person',
      error: error.message
    });
  }
});

// Delete a person
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const person = await Person.findOneAndDelete({
      _id: req.params.id,
      lawyer: req.user.userId
    });

    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting person',
      error: error.message
    });
  }
});

// Get cases associated with a person (Universal cases endpoint)
router.get('/:id/cases', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    // Search for cases where this ID is in the clients or contacts array
    const cases = await Case.find({
      lawyer: userId,
      $or: [
        { clients: id },
        { contacts: id }
      ]
    })
      .populate('clients', 'firstName lastName email companyName contactPerson')
      .populate('contacts', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching person cases:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
