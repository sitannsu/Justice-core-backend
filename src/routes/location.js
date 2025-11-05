const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

// @route   POST api/locations
// @desc    Create a new location
// @access  Private
router.post('/', [
  auth,
  [
    check('name', 'Location name is required').not().isEmpty(),
    check('address', 'Address is required').not().isEmpty(),
    check('city', 'City is required').not().isEmpty(),
    check('state', 'State is required').not().isEmpty(),
    check('country', 'Country is required').not().isEmpty(),
    check('pincode', 'Pincode is required').not().isEmpty(),
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const location = new Location({
      name: req.body.name,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country,
      pincode: req.body.pincode,
      coordinates: req.body.coordinates,
      isActive: true,
      createdBy: req.user.id
    });

    await location.save();
    res.json(location);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/locations
// @desc    Get all locations
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const locations = await Location.find().sort({ createdAt: -1 });
    res.json(locations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/locations/:id
// @desc    Get location by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ msg: 'Location not found' });
    }
    res.json(location);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Location not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/locations/:id
// @desc    Update a location
// @access  Private
router.put('/:id', [
  auth,
  [
    check('name', 'Location name is required').not().isEmpty(),
    check('address', 'Address is required').not().isEmpty(),
    check('city', 'City is required').not().isEmpty(),
    check('state', 'State is required').not().isEmpty(),
    check('country', 'Country is required').not().isEmpty(),
    check('pincode', 'Pincode is required').not().isEmpty(),
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ msg: 'Location not found' });
    }

    location = await Location.findByIdAndUpdate(
      req.params.id,
      { 
        $set: {
          name: req.body.name,
          address: req.body.address,
          city: req.body.city,
          state: req.body.state,
          country: req.body.country,
          pincode: req.body.pincode,
          coordinates: req.body.coordinates,
          updatedBy: req.user.id,
          updatedAt: Date.now()
        }
      },
      { new: true }
    );

    res.json(location);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/locations/:id
// @desc    Delete a location
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ msg: 'Location not found' });
    }

    await location.remove();
    res.json({ msg: 'Location removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Location not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
