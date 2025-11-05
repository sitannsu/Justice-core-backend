const express = require('express');
const auth = require('../middleware/auth');
const CaseActivity = require('../models/CaseActivity');
const Case = require('../models/Case');

const router = express.Router();

// Get case timeline
router.get('/case/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { type, category, limit, isPublic } = req.query;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const options = {};
    if (type) options.type = type;
    if (category) options.category = category;
    if (limit) options.limit = parseInt(limit);
    if (isPublic !== undefined) options.isPublic = isPublic === 'true';

    const activities = await CaseActivity.getCaseTimeline(caseId, options);

    res.json(activities);

  } catch (error) {
    console.error('Error fetching case timeline:', error);
    res.status(500).json({ message: 'Server error while fetching case timeline' });
  }
});

// Create a new case activity
router.post('/', auth, async (req, res) => {
  try {
    const {
      case: caseId,
      type,
      title,
      description,
      details,
      metadata,
      priority,
      category,
      isPublic,
      requiresAction,
      actionRequired,
      actionDeadline,
      assignedTo,
      tags
    } = req.body;

    // Validate required fields
    if (!caseId || !type || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const activity = new CaseActivity({
      case: caseId,
      type,
      title,
      description,
      details: details || {},
      metadata: metadata || {},
      priority: priority || 'medium',
      category: category || 'case_management',
      isPublic: isPublic !== undefined ? isPublic : true,
      requiresAction: requiresAction || false,
      actionRequired,
      actionDeadline: actionDeadline ? new Date(actionDeadline) : undefined,
      assignedTo,
      tags: tags || [],
      createdBy: req.user.userId
    });

    await activity.save();

    // Populate user information for response
    await activity.populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'assignedTo', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      message: 'Case activity created successfully',
      activity
    });

  } catch (error) {
    console.error('Error creating case activity:', error);
    res.status(500).json({ message: 'Server error while creating case activity' });
  }
});

// Get a specific case activity
router.get('/:id', auth, async (req, res) => {
  try {
    const activity = await CaseActivity.findById(req.params.id)
      .populate('case', 'caseName caseNumber')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('completedBy', 'firstName lastName email');

    if (!activity) {
      return res.status(404).json({ message: 'Case activity not found' });
    }

    // Verify user has access to the case
    const caseDoc = await Case.findById(activity.case);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case activity' });
    }

    res.json(activity);

  } catch (error) {
    console.error('Error fetching case activity:', error);
    res.status(500).json({ message: 'Server error while fetching case activity' });
  }
});

// Update a case activity
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      details,
      metadata,
      priority,
      category,
      isPublic,
      requiresAction,
      actionRequired,
      actionDeadline,
      assignedTo,
      tags
    } = req.body;

    const activity = await CaseActivity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Case activity not found' });
    }

    // Verify user has access to the case
    const caseDoc = await Case.findById(activity.case);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case activity' });
    }

    // Update allowed fields
    if (title !== undefined) activity.title = title;
    if (description !== undefined) activity.description = description;
    if (details !== undefined) activity.details = details;
    if (metadata !== undefined) activity.metadata = metadata;
    if (priority !== undefined) activity.priority = priority;
    if (category !== undefined) activity.category = category;
    if (isPublic !== undefined) activity.isPublic = isPublic;
    if (requiresAction !== undefined) activity.requiresAction = requiresAction;
    if (actionRequired !== undefined) activity.actionRequired = actionRequired;
    if (actionDeadline !== undefined) activity.actionDeadline = actionDeadline ? new Date(actionDeadline) : undefined;
    if (assignedTo !== undefined) activity.assignedTo = assignedTo;
    if (tags !== undefined) activity.tags = tags;

    await activity.save();

    // Populate user information for response
    await activity.populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'assignedTo', select: 'firstName lastName email' }
    ]);

    res.json({
      message: 'Case activity updated successfully',
      activity
    });

  } catch (error) {
    console.error('Error updating case activity:', error);
    res.status(500).json({ message: 'Server error while updating case activity' });
  }
});

// Delete a case activity
router.delete('/:id', auth, async (req, res) => {
  try {
    const activity = await CaseActivity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Case activity not found' });
    }

    // Verify user has access to the case
    const caseDoc = await Case.findById(activity.case);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case activity' });
    }

    await CaseActivity.findByIdAndDelete(req.params.id);

    res.json({ message: 'Case activity deleted successfully' });

  } catch (error) {
    console.error('Error deleting case activity:', error);
    res.status(500).json({ message: 'Server error while deleting case activity' });
  }
});

// Mark activity as completed
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const { notes } = req.body;

    const activity = await CaseActivity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Case activity not found' });
    }

    // Verify user has access to the case
    const caseDoc = await Case.findById(activity.case);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case activity' });
    }

    activity.completedBy = req.user.userId;
    activity.completedAt = new Date();
    if (notes) {
      activity.metadata = { ...activity.metadata, completionNotes: notes };
    }

    await activity.save();

    // Populate user information for response
    await activity.populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'assignedTo', select: 'firstName lastName email' },
      { path: 'completedBy', select: 'firstName lastName email' }
    ]);

    res.json({
      message: 'Case activity marked as completed',
      activity
    });

  } catch (error) {
    console.error('Error completing case activity:', error);
    res.status(500).json({ message: 'Server error while completing case activity' });
  }
});

// Get pending actions for a case
router.get('/case/:caseId/pending', auth, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const pendingActions = await CaseActivity.getPendingActions(caseId);

    res.json(pendingActions);

  } catch (error) {
    console.error('Error fetching pending actions:', error);
    res.status(500).json({ message: 'Server error while fetching pending actions' });
  }
});

// Get recent activities for a case
router.get('/case/:caseId/recent', auth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { limit = 10 } = req.query;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const recentActivities = await CaseActivity.getRecentActivities(caseId, parseInt(limit));

    res.json(recentActivities);

  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ message: 'Server error while fetching recent activities' });
  }
});

// Get activities by type
router.get('/case/:caseId/type/:type', auth, async (req, res) => {
  try {
    const { caseId, type } = req.params;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const activities = await CaseActivity.find({ case: caseId, type })
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(activities);

  } catch (error) {
    console.error('Error fetching activities by type:', error);
    res.status(500).json({ message: 'Server error while fetching activities by type' });
  }
});

// Get activities by category
router.get('/case/:caseId/category/:category', auth, async (req, res) => {
  try {
    const { caseId, category } = req.params;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const activities = await CaseActivity.find({ case: caseId, category })
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(activities);

  } catch (error) {
    console.error('Error fetching activities by category:', error);
    res.status(500).json({ message: 'Server error while fetching activities by category' });
  }
});

module.exports = router;
