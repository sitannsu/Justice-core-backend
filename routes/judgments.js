const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Stub endpoint: list courts for judgment search filters
router.get('/courts', auth, async (req, res) => {
  // Simple static list for now; can be wired to real data later
  res.json([
    'Supreme Court of India',
    'Delhi High Court',
    'Bombay High Court',
    'Madras High Court',
    'Karnataka High Court',
  ]);
});

// Stub endpoint: list case types for judgment search filters
router.get('/case-types', auth, async (req, res) => {
  res.json([
    'Civil',
    'Criminal',
    'Constitutional',
    'Commercial',
    'Family',
    'Labour',
  ]);
});

// Stub endpoint: semantic judgment search
// For now this just returns an empty result set so the UI does not error.
router.post('/search', auth, async (req, res) => {
  const { query, filters } = req.body || {};

  // TODO: wire to real semantic search (e.g., Supabase function or vector DB)
  res.json({
    query: query || '',
    filters: filters || {},
    results: [],
    total: 0,
  });
});

module.exports = router;
