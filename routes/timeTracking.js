const express = require('express');
const auth = require('../middleware/auth');
const TimeEntry = require('../models/TimeEntry');
const Case = require('../models/Case');

const router = express.Router();

// Create a new time entry
router.post('/', auth, async (req, res) => {
  try {
    const { caseId, employee, activity, notes, rate, hours, nonBillable, startTime } = req.body;

    // Validate required fields
    if (!caseId || !employee || !activity || !rate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const timeEntry = new TimeEntry({
      caseId,
      caseName: caseDoc.caseName,
      date: new Date(),
      employee,
      activity,
      notes: notes || '',
      rate,
      hours: hours || 0,
      nonBillable: nonBillable || false,
      startTime: startTime ? new Date(startTime) : undefined,
      createdBy: req.user.userId,
      lastModifiedBy: req.user.userId
    });

    await timeEntry.save();

    // Populate case info for response
    await timeEntry.populate('caseId', 'caseName caseNumber');

    res.status(201).json({
      message: 'Time entry created successfully',
      timeEntry
    });

  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ message: 'Server error while creating time entry' });
  }
});

// Get time entries with optional filters
router.get('/', auth, async (req, res) => {
  try {
    const { caseId, startDate, endDate, status } = req.query;
    const match = { createdBy: req.user.userId };

    if (caseId) match.caseId = caseId;
    if (status) match.status = status;
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const timeEntries = await TimeEntry.find(match)
      .populate('caseId', 'caseName caseNumber')
      .sort({ date: -1, createdAt: -1 });

    res.json(timeEntries);

  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ message: 'Server error while fetching time entries' });
  }
});

// Get a specific time entry
router.get('/:id', auth, async (req, res) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id)
      .populate('caseId', 'caseName caseNumber');

    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    res.json(timeEntry);

  } catch (error) {
    console.error('Error fetching time entry:', error);
    res.status(500).json({ message: 'Server error while fetching time entry' });
  }
});

// Update a time entry
router.put('/:id', auth, async (req, res) => {
  try {
    const { employee, activity, notes, rate, hours, nonBillable, endTime } = req.body;

    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    // Update allowed fields
    if (employee !== undefined) timeEntry.employee = employee;
    if (activity !== undefined) timeEntry.activity = activity;
    if (notes !== undefined) timeEntry.notes = notes;
    if (rate !== undefined) timeEntry.rate = rate;
    if (hours !== undefined) timeEntry.hours = hours;
    if (nonBillable !== undefined) timeEntry.nonBillable = nonBillable;
    if (endTime !== undefined) timeEntry.endTime = new Date(endTime);

    timeEntry.lastModifiedBy = req.user.userId;

    await timeEntry.save();

    // Populate case info for response
    await timeEntry.populate('caseId', 'caseName caseNumber');

    res.json({
      message: 'Time entry updated successfully',
      timeEntry
    });

  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ message: 'Server error while updating time entry' });
  }
});

// Delete a time entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    await TimeEntry.findByIdAndDelete(req.params.id);

    res.json({ message: 'Time entry deleted successfully' });

  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ message: 'Server error while deleting time entry' });
  }
});

// Start timer
router.post('/:id/start', auth, async (req, res) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    // Stop any other running timers for this user
    await TimeEntry.updateMany(
      { createdBy: req.user.userId, isRunning: true },
      { isRunning: false, status: 'paused' }
    );

    await timeEntry.startTimer();
    await timeEntry.populate('caseId', 'caseName caseNumber');

    res.json({
      message: 'Timer started successfully',
      timeEntry
    });

  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ message: 'Server error while starting timer' });
  }
});

// Stop timer
router.post('/:id/stop', auth, async (req, res) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    await timeEntry.stopTimer();
    await timeEntry.populate('caseId', 'caseName caseNumber');

    res.json({
      message: 'Timer stopped successfully',
      timeEntry
    });

  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ message: 'Server error while stopping timer' });
  }
});

// Pause timer
router.post('/:id/pause', auth, async (req, res) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    await timeEntry.pauseTimer();
    await timeEntry.populate('caseId', 'caseName caseNumber');

    res.json({
      message: 'Timer paused successfully',
      timeEntry
    });

  } catch (error) {
    console.error('Error pausing timer:', error);
    res.status(500).json({ message: 'Server error while pausing timer' });
  }
});

// Resume timer
router.post('/:id/resume', auth, async (req, res) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      return res.status(404).json({ message: 'Time entry not found' });
    }

    // Check access permissions
    if (timeEntry.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this time entry' });
    }

    // Stop any other running timers for this user
    await TimeEntry.updateMany(
      { createdBy: req.user.userId, isRunning: true },
      { isRunning: false, status: 'paused' }
    );

    await timeEntry.resumeTimer();
    await timeEntry.populate('caseId', 'caseName caseNumber');

    res.json({
      message: 'Timer resumed successfully',
      timeEntry
    });

  } catch (error) {
    console.error('Error resuming timer:', error);
    res.status(500).json({ message: 'Server error while resuming timer' });
  }
});

// Get running timers
router.get('/running', auth, async (req, res) => {
  try {
    const runningTimers = await TimeEntry.getRunningTimers(req.user.userId);
    res.json(runningTimers);
  } catch (error) {
    console.error('Error fetching running timers:', error);
    res.status(500).json({ message: 'Server error while fetching running timers' });
  }
});

// Get time entry statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { caseId, startDate, endDate } = req.query;
    
    const stats = await TimeEntry.getStats(
      req.user.userId,
      caseId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    const result = stats[0] || {
      totalHours: 0,
      billableHours: 0,
      nonBillableHours: 0,
      totalAmount: 0
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching time entry stats:', error);
    res.status(500).json({ message: 'Server error while fetching time entry stats' });
  }
});

// Get time entries by case
router.get('/case/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const timeEntries = await TimeEntry.find({ 
      caseId, 
      createdBy: req.user.userId 
    })
    .populate('caseId', 'caseName caseNumber')
    .sort({ date: -1, createdAt: -1 });

    res.json(timeEntries);

  } catch (error) {
    console.error('Error fetching time entries by case:', error);
    res.status(500).json({ message: 'Server error while fetching time entries' });
  }
});

module.exports = router;
