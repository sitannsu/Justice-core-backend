const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const Case = require('../models/Case'); // Added import for Case model

// Get events by client ID
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const events = await Event.find({ caseId: { $in: await Case.find({ clients: req.params.clientId }).select('_id') } })
      .populate('caseId', 'number title')
      .populate('attendees', 'firstName lastName');
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

// Get events by date range
router.get('/range', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        message: 'Start date and end date are required',
        required: ['startDate', 'endDate']
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        message: 'Invalid date format. Use ISO 8601 format (e.g., 2025-08-13T00:00:00.000Z)'
      });
    }

    const events = await Event.find({
      date: {
        $gte: start,
        $lte: end
      }
    })
    .populate('caseId', 'number title')
    .populate('attendees', 'firstName lastName')
    .sort({ date: 1, startTime: 1 });

    res.json(events);
  } catch (error) {
    console.error('Error fetching events by range:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new event
router.post('/', auth, async (req, res) => {
  console.log('Received event data:', req.body);
  console.log('User ID:', req.user.userId);
  
  // Validate required fields
  if (!req.body.title || !req.body.type || !req.body.date || !req.body.startTime || !req.body.endTime || !req.body.location || !req.body.description) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['title', 'type', 'date', 'startTime', 'endTime', 'location', 'description'],
      received: Object.keys(req.body)
    });
  }
  
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
    attendees: req.body.attendees || [],
    creator: req.user.userId
  });

  try {
    console.log('Event object to save:', event);
    const newEvent = await event.save();
    console.log('Event saved successfully:', newEvent);
    
    const populatedEvent = await Event.findById(newEvent._id)
      .populate('caseId', 'number title')
      .populate('attendees', 'firstName lastName');
    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error('Error saving event:', error);
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
