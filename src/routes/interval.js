const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const LocationInterval = require('../models/LocationInterval');

// @route   POST api/interval
// @desc    Create a new location interval
// @access  Private
router.post('/', [
  auth,
  [
    check('locationId', 'Location ID is required').not().isEmpty(),
    check('startTime', 'Start time is required').not().isEmpty(),
    check('endTime', 'End time is required').not().isEmpty(),
    check('days', 'Days are required').isArray().not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const interval = new LocationInterval({
      locationId: req.body.locationId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      days: req.body.days,
      isActive: true,
      createdBy: req.user.id
    });

    await interval.save();
    res.json(interval);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/interval
// @desc    Get all intervals
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const intervals = await LocationInterval.find()
      .populate('locationId', 'name')
      .sort({ createdAt: -1 });
    res.json(intervals);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/interval/location/:locationId
// @desc    Get intervals by location ID
// @access  Private
router.get('/location/:locationId', auth, async (req, res) => {
  try {
    const intervals = await LocationInterval.find({ locationId: req.params.locationId })
      .populate('locationId', 'name')
      .sort({ createdAt: -1 });
    res.json(intervals);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/interval/:id
// @desc    Get interval by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const interval = await LocationInterval.findById(req.params.id)
      .populate('locationId', 'name');
    
    if (!interval) {
      return res.status(404).json({ msg: 'Interval not found' });
    }
    res.json(interval);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Interval not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/interval/:id
// @desc    Update an interval
// @access  Private
router.put('/:id', [
  auth,
  [
    check('startTime', 'Start time is required').not().isEmpty(),
    check('endTime', 'End time is required').not().isEmpty(),
    check('days', 'Days are required').isArray().not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let interval = await LocationInterval.findById(req.params.id);
    if (!interval) {
      return res.status(404).json({ msg: 'Interval not found' });
    }

    interval = await LocationInterval.findByIdAndUpdate(
      req.params.id,
      { 
        $set: {
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          days: req.body.days,
          updatedBy: req.user.id,
          updatedAt: Date.now()
        }
      },
      { new: true }
    ).populate('locationId', 'name');

    res.json(interval);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/interval/:id
// @desc    Delete an interval
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const interval = await LocationInterval.findById(req.params.id);
    if (!interval) {
      return res.status(404).json({ msg: 'Interval not found' });
    }

    await interval.remove();
    res.json({ msg: 'Interval removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Interval not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
