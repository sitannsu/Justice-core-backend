const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const googleCalendar = require('../services/googleCalendar');
const User = require('../models/User');

// Get Google Calendar auth URL
router.get('/auth-url', auth, async (req, res) => {
  try {
    const authUrl = googleCalendar.getAuthUrl();
    res.json({ url: authUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Handle Google Calendar OAuth callback
router.get('/oauth-callback', auth, async (req, res) => {
  try {
    const { code } = req.query;
    const tokens = await googleCalendar.getTokens(code);
    
    // Save tokens to user profile
    await User.findByIdAndUpdate(req.user._id, {
      googleCalendarTokens: tokens
    });

    res.json({ message: 'Calendar connected successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Sync events from Google Calendar
router.get('/sync', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.googleCalendarTokens) {
      return res.status(401).json({ message: 'Google Calendar not connected' });
    }

    googleCalendar.setCredentials(user.googleCalendarTokens);
    const events = await googleCalendar.listEvents();
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create event in Google Calendar
router.post('/events', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.googleCalendarTokens) {
      return res.status(401).json({ message: 'Google Calendar not connected' });
    }

    googleCalendar.setCredentials(user.googleCalendarTokens);
    const event = await googleCalendar.createEvent(req.body);
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update event in Google Calendar
router.put('/events/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.googleCalendarTokens) {
      return res.status(401).json({ message: 'Google Calendar not connected' });
    }

    googleCalendar.setCredentials(user.googleCalendarTokens);
    const event = await googleCalendar.updateEvent(req.params.id, req.body);
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete event from Google Calendar
router.delete('/events/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.googleCalendarTokens) {
      return res.status(401).json({ message: 'Google Calendar not connected' });
    }

    googleCalendar.setCredentials(user.googleCalendarTokens);
    await googleCalendar.deleteEvent(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
