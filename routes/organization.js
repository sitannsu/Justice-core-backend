const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get organization members for Team Chat and org management UIs
router.get('/members', auth, async (req, res) => {
  try {
    // For now, return all active users in the tenant except the current user
    const currentUserId = req.user.userId;

    const users = await User.find({
      isActive: true,
    }).select('firstName lastName email role tenant_id');

    const members = users
      .filter(u => String(u._id) !== String(currentUserId))
      .map(u => ({
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        tenantId: u.tenant_id,
      }));

    res.json(members);
  } catch (error) {
    console.error('Error fetching organization members:', error);
    res.status(500).json({ message: 'Failed to fetch organization members' });
  }
});

module.exports = router;
