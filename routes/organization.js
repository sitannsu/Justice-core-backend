const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Case = require('../models/Case');
const CaseAssignment = require('../models/CaseAssignment');
const WorkSession = require('../models/WorkSession');
const UserDepartment = require('../models/UserDepartment');

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

// Lightweight Activity feed (placeholder)
router.get('/activity', auth, async (req, res) => {
  try {
    // Placeholder values; replace with real analytics later
    res.json({
      summary: {
        loginsToday: 0,
        casesStarted: 0,
        documentsUploaded: 0,
        commentsAdded: 0
      },
      recent: [] // recent actions
    });
  } catch (error) {
    console.error('Error fetching organization activity:', error);
    res.status(500).json({ message: 'Failed to fetch activity' });
  }
});

// Get members of a specific department
router.get('/members/department/:departmentId', auth, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const assignments = await UserDepartment.find({
      department_id: departmentId,
      is_active: true
    }).populate('user_id', 'firstName lastName email');

    const members = assignments
      .filter((a) => !!a.user_id)
      .map((a) => ({
        _id: a.user_id._id,
        firstName: a.user_id.firstName,
        lastName: a.user_id.lastName,
        email: a.user_id.email
      }));

    res.json(members);
  } catch (error) {
    console.error('Error fetching department members:', error);
    res.status(500).json({ message: 'Failed to fetch department members' });
  }
});

// ===== Case Assignments =====

// GET /api/organization/case-assignments?lawyerId=...
router.get('/case-assignments', auth, async (req, res) => {
  try {
    const lawyerId = req.query.lawyerId || req.user.userId;
    // Find cases owned by lawyer
    const cases = await Case.find({ lawyer: lawyerId }).select('_id title caseName caseNumber');
    const caseIds = cases.map((c) => c._id);
    if (caseIds.length === 0) return res.json([]);

    const assignments = await CaseAssignment.find({ matter_id: { $in: caseIds } })
      .sort({ assignment_date: -1 })
      .populate('matter_id', 'caseName caseNumber')
      .populate('user_id', 'firstName lastName email');

    const mapped = assignments.map((a) => ({
      _id: a._id,
      matter_id: a.matter_id?._id,
      user_id: a.user_id?._id,
      assignment_type: a.assignment_type,
      hourly_rate: a.hourly_rate,
      is_active: a.is_active,
      notes: a.notes,
      assignment_date: a.assignment_date,
      completion_date: a.completion_date,
      matter_title: a.matter_id?.caseName || '',
      matter_number: a.matter_id?.caseNumber || '',
      user: {
        _id: a.user_id?._id,
        firstName: a.user_id?.firstName,
        lastName: a.user_id?.lastName,
        email: a.user_id?.email
      }
    }));
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching case assignments:', error);
    res.status(500).json({ message: 'Failed to fetch case assignments' });
  }
});

// POST /api/organization/case-assignments
router.post('/case-assignments', auth, async (req, res) => {
  try {
    const { matter_id, user_id, assignment_type, hourly_rate, notes } = req.body || {};
    if (!matter_id || !user_id) return res.status(400).json({ message: 'matter_id and user_id are required' });
    // Ensure the case belongs to current lawyer
    const matter = await Case.findById(matter_id);
    if (!matter) return res.status(404).json({ message: 'Case not found' });
    if (String(matter.lawyer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const assignment = await CaseAssignment.create({
      matter_id,
      user_id,
      assignment_type: assignment_type || 'associate',
      hourly_rate,
      notes
    });

    const populated = await assignment
      .populate('matter_id', 'caseName caseNumber')
      .populate('user_id', 'firstName lastName email');

    res.status(201).json({
      _id: populated._id,
      matter_id: populated.matter_id?._id,
      user_id: populated.user_id?._id,
      assignment_type: populated.assignment_type,
      hourly_rate: populated.hourly_rate,
      is_active: populated.is_active,
      notes: populated.notes,
      assignment_date: populated.assignment_date,
      completion_date: populated.completion_date,
      matter_title: populated.matter_id?.caseName || '',
      matter_number: populated.matter_id?.caseNumber || '',
      user: {
        _id: populated.user_id?._id,
        firstName: populated.user_id?.firstName,
        lastName: populated.user_id?.lastName,
        email: populated.user_id?.email
      }
    });
  } catch (error) {
    console.error('Error creating case assignment:', error);
    res.status(500).json({ message: 'Failed to create case assignment' });
  }
});

// DELETE /api/organization/case-assignments/:id
router.delete('/case-assignments/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await CaseAssignment.findById(id).populate('matter_id', 'lawyer');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    // Ensure the case belongs to current lawyer
    if (!assignment.matter_id || String(assignment.matter_id.lawyer) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Access denied to this assignment' });
    }
    assignment.is_active = false;
    assignment.completion_date = new Date();
    await assignment.save();
    res.json({ message: 'Assignment deactivated' });
  } catch (error) {
    console.error('Error deleting case assignment:', error);
    res.status(500).json({ message: 'Failed to delete case assignment' });
  }
});

// ===== Work Sessions =====

// GET current active session
router.get('/work-sessions/current', auth, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      user_id: req.user.userId,
      is_active: true,
      session_end: { $exists: false }
    }).sort({ session_start: -1 });
    res.json(session || null);
  } catch (error) {
    console.error('Error fetching current work session:', error);
    res.status(500).json({ message: 'Failed to fetch current work session' });
  }
});

// GET recent sessions
router.get('/work-sessions/recent', auth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const sessions = await WorkSession.find({ user_id: req.user.userId })
      .sort({ session_start: -1 })
      .limit(limit);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching recent work sessions:', error);
    res.status(500).json({ message: 'Failed to fetch recent work sessions' });
  }
});

// POST start session
router.post('/work-sessions', auth, async (req, res) => {
  try {
    const { session_type, location, notes } = req.body || {};

    // End any dangling active sessions for safety
    await WorkSession.updateMany(
      { user_id: req.user.userId, is_active: true, session_end: { $exists: false } },
      { $set: { is_active: false, session_end: new Date() } }
    );

    // Pull tenant from user for now
    const user = await User.findById(req.user.userId);
    const tenantId = user?.tenant_id || 'default';

    const created = await WorkSession.create({
      user_id: req.user.userId,
      tenant_id: tenantId,
      session_type: session_type || 'office',
      location,
      notes
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error starting work session:', error);
    res.status(500).json({ message: 'Failed to start work session' });
  }
});

// POST end session
router.post('/work-sessions/:id/end', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await WorkSession.findById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (String(session.user_id) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (session.session_end) {
      return res.json(session); // already ended
    }
    session.session_end = new Date();
    const ms = new Date(session.session_end).getTime() - new Date(session.session_start).getTime();
    session.total_hours = Math.max(ms / (1000 * 60 * 60), 0);
    session.is_active = false;
    await session.save();
    res.json(session);
  } catch (error) {
    console.error('Error ending work session:', error);
    res.status(500).json({ message: 'Failed to end work session' });
  }
});

module.exports = router;
