const express = require('express');
const router = express.Router();
const Interval = require('../models/Interval');

// Get interval for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    let interval = await Interval.findOne({ userId });
    
    // If no interval found, create default
    if (!interval) {
      interval = await Interval.create({
        userId: userId,
        interval: 15,
        unit: 'minutes'
      });
    }
    
    res.json({
      userId: interval.userId,
      interval: interval.interval,
      unit: interval.unit,
      message: `Current interval for user ${userId} is ${interval.interval} ${interval.unit}`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set/Update interval for a user
router.post('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { interval, unit = 'minutes' } = req.body;
    
    // Validate interval
    if (!interval || interval <= 0) {
      return res.status(400).json({ 
        message: 'Interval must be a positive number' 
      });
    }
    
    // Validate unit
    const validUnits = ['seconds', 'minutes', 'hours', 'days'];
    if (!validUnits.includes(unit)) {
      return res.status(400).json({ 
        message: 'Unit must be seconds, minutes, hours, or days' 
      });
    }
    
    // Find existing interval or create new one
    let intervalDoc = await Interval.findOne({ userId });
    
    if (intervalDoc) {
      // Update existing
      intervalDoc.interval = interval;
      intervalDoc.unit = unit;
      await intervalDoc.save();
    } else {
      // Create new
      intervalDoc = await Interval.create({
        userId: userId,
        interval: interval,
        unit: unit
      });
    }
    
    res.json({
      userId: intervalDoc.userId,
      interval: intervalDoc.interval,
      unit: intervalDoc.unit,
      message: `Interval updated for user ${userId} to ${interval} ${unit}`,
      updatedAt: intervalDoc.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all intervals
router.get('/', async (req, res) => {
  try {
    const intervals = await Interval.find().sort({ userId: 1 });
    
    res.json({
      intervals: intervals,
      count: intervals.length,
      message: `Found ${intervals.length} interval configurations`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 