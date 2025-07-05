const express = require('express');
const router = express.Router();
const Location = require('../models/Location');

// Get all locations
router.get('/', async (req, res) => {
  try {
    const locations = await Location.find().sort({ timestamp: -1 });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get list of locations with additional details
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 10, userId } = req.query;
    
    // Build query
    const query = {};
    if (userId) {
      query.userId = parseInt(userId);
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get locations with pagination
    const locations = await Location.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination info
    const total = await Location.countDocuments(query);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;
    
    // Format response with additional details
    const formattedLocations = locations.map(location => ({
      id: location._id,
      lat: location.lat,
      lng: location.lng,
      coordinates: `${location.lat}, ${location.lng}`,
      timestamp: location.timestamp,
      userId: location.userId,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      // Add some useful calculated fields
      timeAgo: getTimeAgo(location.timestamp),
      dateFormatted: formatDate(location.timestamp)
    }));
    
    res.json({
      locations: formattedLocations,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      },
      summary: {
        totalLocations: total,
        filteredBy: userId ? `User ID: ${userId}` : 'All users'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to get time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
}

// Helper function to format date
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Update location (create new location entry)
router.post('/', async (req, res) => {
  try {
    const { lat, lng, timestamp, userId = 5 } = req.body;
    
    // Validate required fields
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const location = new Location({
      lat,
      lng,
      timestamp: timestamp || new Date(),
      userId
    });

    const newLocation = await location.save();
    res.status(201).json(newLocation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get locations by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const locations = await Location.find({ userId }).sort({ timestamp: -1 });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get latest location for a user
router.get('/user/:userId/latest', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const location = await Location.findOne({ userId }).sort({ timestamp: -1 });
    
    if (!location) {
      return res.status(404).json({ message: 'No location found for this user' });
    }
    
    res.json(location);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 