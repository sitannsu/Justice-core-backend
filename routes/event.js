const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');

// Get all events
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.find()
      .populate('caseId', 'number title')
      .populate('attendees', 'firstName lastName');
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new event
router.post('/', auth, async (req, res) => {
  // Parse the date string into a proper Date object
  const eventDate = new Date(req.body.date);
  console.log('Creating event with date:', eventDate);

  const event = new Event({
    title: req.body.title,
    type: req.body.type,
    date: eventDate,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    location: req.body.location,
    description: req.body.description,
    caseId: req.body.caseId,
    priority: req.body.priority,
    attendees: req.body.attendees,
    creator: req.user.userId
  });

  try {
    const newEvent = await event.save();
    const populatedEvent = await Event.findById(newEvent._id)
      .populate('caseId', 'number title')
      .populate('attendees', 'firstName lastName');
    res.status(201).json(populatedEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get one event
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('caseId', 'number title')
      .populate('attendees', 'firstName lastName');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update event
router.put('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    Object.assign(event, req.body);
    const updatedEvent = await event.save();
    const populatedEvent = await Event.findById(updatedEvent._id)
      .populate('caseId', 'number title')
      .populate('attendees', 'firstName lastName');
    res.json(populatedEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    await event.remove();
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
