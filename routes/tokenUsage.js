const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TokenUsage = require('../models/TokenUsage');

// GET /api/token-usage/summary - Get token usage summary for current user
router.get('/summary', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const totalRecords = await TokenUsage.countDocuments({ userId: req.user.userId });
    const allRecords = await TokenUsage.countDocuments();
    console.log(`[TokenUsage] Summary for user ${req.user.userId} | user records: ${totalRecords} | all records: ${allRecords}`);
    const summary = await TokenUsage.getUserSummary(req.user.userId, days);
    console.log('[TokenUsage] Summary result:', JSON.stringify(summary));
    res.json(summary);
  } catch (error) {
    console.error('Error fetching token usage summary:', error);
    res.status(500).json({ message: 'Failed to fetch token usage summary' });
  }
});

// GET /api/token-usage/by-feature - Get usage breakdown by feature
router.get('/by-feature', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const usage = await TokenUsage.getUsageByFeature(req.user.userId, days);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching usage by feature:', error);
    res.status(500).json({ message: 'Failed to fetch usage by feature' });
  }
});

// GET /api/token-usage/daily - Get daily usage for charts
router.get('/daily', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const usage = await TokenUsage.getDailyUsage(req.user.userId, days);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching daily usage:', error);
    res.status(500).json({ message: 'Failed to fetch daily usage' });
  }
});

// GET /api/token-usage/recent - Get recent token usage entries
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const entries = await TokenUsage.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('endpoint model promptTokens completionTokens totalTokens estimatedCost feature createdAt');
    res.json(entries);
  } catch (error) {
    console.error('Error fetching recent usage:', error);
    res.status(500).json({ message: 'Failed to fetch recent usage' });
  }
});

module.exports = router;
