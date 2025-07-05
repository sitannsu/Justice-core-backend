const express = require('express');
const router = express.Router();
const Person = require('../models/Person');
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
    const persons = await Person.find({ lawyer: req.user.userId });
    res.json(persons);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching persons',
      error: error.message
    });
  }
});

module.exports = router;
