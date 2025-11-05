const express = require('express');
const auth = require('../middleware/auth');
const Attorney = require('../models/Attorney');
const Case = require('../models/Case');
const User = require('../models/User');

const router = express.Router();

// Create a new attorney
router.post('/', auth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      barNumber,
      practiceAreas,
      specialization,
      hourlyRate,
      experience,
      bio
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: 'First name, last name, and email are required' });
    }

    // Check if email already exists
    const existingAttorney = await Attorney.findOne({ email });
    if (existingAttorney) {
      return res.status(400).json({ message: 'Attorney with this email already exists' });
    }

    // Verify user is a firm or has permission to create attorneys
    if (req.user.role !== 'firm' && req.user.role !== 'lawyer') {
      return res.status(403).json({ message: 'Only firms and lawyers can create attorneys' });
    }

    const attorney = new Attorney({
      firstName,
      lastName,
      email,
      phone,
      barNumber,
      practiceAreas: practiceAreas || [],
      specialization,
      hourlyRate: hourlyRate || 0,
      experience: experience || 'mid-level',
      bio,
      createdBy: req.user.userId,
      firm: req.user.role === 'firm' ? req.user.userId : req.user.firm || req.user.userId
    });

    await attorney.save();

    res.status(201).json({
      message: 'Attorney created successfully',
      attorney
    });

  } catch (error) {
    console.error('Error creating attorney:', error);
    res.status(500).json({ message: 'Server error while creating attorney' });
  }
});

// Get all attorneys for a firm
router.get('/', auth, async (req, res) => {
  try {
    const { status, practiceArea, experience } = req.query;
    const match = {};

    // Determine firm ID
    let firmId = req.user.userId;
    if (req.user.role === 'lawyer' && req.user.firm) {
      firmId = req.user.firm;
    }

    match.firm = firmId;

    if (status) match.status = status;
    if (practiceArea) match.practiceAreas = { $in: [practiceArea] };
    if (experience) match.experience = experience;

    const attorneys = await Attorney.find(match)
      .populate('assignedCases', 'caseName caseNumber status')
      .sort({ lastName: 1, firstName: 1 });

    res.json(attorneys);

  } catch (error) {
    console.error('Error fetching attorneys:', error);
    res.status(500).json({ message: 'Server error while fetching attorneys' });
  }
});

// Get a specific attorney
router.get('/:id', auth, async (req, res) => {
  try {
    const attorney = await Attorney.findById(req.params.id)
      .populate('assignedCases', 'caseName caseNumber status practiceArea dateOpened')
      .populate('firm', 'firstName lastName email');

    if (!attorney) {
      return res.status(404).json({ message: 'Attorney not found' });
    }

    // Check access permissions
    if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
      return res.status(403).json({ message: 'Access denied to this attorney' });
    }

    res.json(attorney);

  } catch (error) {
    console.error('Error fetching attorney:', error);
    res.status(500).json({ message: 'Server error while fetching attorney' });
  }
});

// Update an attorney
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      barNumber,
      practiceAreas,
      specialization,
      hourlyRate,
      experience,
      bio,
      status
    } = req.body;

    const attorney = await Attorney.findById(req.params.id);
    if (!attorney) {
      return res.status(404).json({ message: 'Attorney not found' });
    }

    // Check access permissions
    if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
      return res.status(403).json({ message: 'Access denied to this attorney' });
    }

    // Update allowed fields
    if (firstName !== undefined) attorney.firstName = firstName;
    if (lastName !== undefined) attorney.lastName = lastName;
    if (email !== undefined) attorney.email = email;
    if (phone !== undefined) attorney.phone = phone;
    if (barNumber !== undefined) attorney.barNumber = barNumber;
    if (practiceAreas !== undefined) attorney.practiceAreas = practiceAreas;
    if (specialization !== undefined) attorney.specialization = specialization;
    if (hourlyRate !== undefined) attorney.hourlyRate = hourlyRate;
    if (experience !== undefined) attorney.experience = experience;
    if (bio !== undefined) attorney.bio = bio;
    if (status !== undefined) attorney.status = status;

    await attorney.save();

    res.json({
      message: 'Attorney updated successfully',
      attorney
    });

  } catch (error) {
    console.error('Error updating attorney:', error);
    res.status(500).json({ message: 'Server error while updating attorney' });
  }
});

// Delete an attorney
router.delete('/:id', auth, async (req, res) => {
  try {
    const attorney = await Attorney.findById(req.params.id);
    if (!attorney) {
      return res.status(404).json({ message: 'Attorney not found' });
    }

    // Check access permissions
    if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
      return res.status(403).json({ message: 'Access denied to this attorney' });
    }

    // Check if attorney has assigned cases
    if (attorney.assignedCases.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete attorney with assigned cases. Please reassign cases first.' 
      });
    }

    await Attorney.findByIdAndDelete(req.params.id);

    res.json({ message: 'Attorney deleted successfully' });

  } catch (error) {
    console.error('Error deleting attorney:', error);
    res.status(500).json({ message: 'Server error while deleting attorney' });
  }
});

// Assign a case to an attorney
router.post('/:id/assign-case', auth, async (req, res) => {
  try {
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({ message: 'Case ID is required' });
    }

    const attorney = await Attorney.findById(req.params.id);
    if (!attorney) {
      return res.status(404).json({ message: 'Attorney not found' });
    }

    // Check access permissions
    if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
      return res.status(403).json({ message: 'Access denied to this attorney' });
    }

    // Verify case exists and belongs to the firm
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    // Check if case is already assigned to this attorney
    if (attorney.assignedCases.includes(caseId)) {
      return res.status(400).json({ message: 'Case is already assigned to this attorney' });
    }

    // Assign case to attorney
    await attorney.assignCase(caseId);

    // Update case with attorney assignment
    caseDoc.assignedAttorney = attorney._id;
    await caseDoc.save();

    // Populate case info for response
    await attorney.populate('assignedCases', 'caseName caseNumber status');

    res.json({
      message: 'Case assigned successfully',
      attorney
    });

  } catch (error) {
    console.error('Error assigning case:', error);
    res.status(500).json({ message: 'Server error while assigning case' });
  }
});

// Unassign a case from an attorney
router.post('/:id/unassign-case', auth, async (req, res) => {
  try {
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({ message: 'Case ID is required' });
    }

    const attorney = await Attorney.findById(req.params.id);
    if (!attorney) {
      return res.status(404).json({ message: 'Attorney not found' });
    }

    // Check access permissions
    if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
      return res.status(403).json({ message: 'Access denied to this attorney' });
    }

    // Check if case is assigned to this attorney
    if (!attorney.assignedCases.includes(caseId)) {
      return res.status(400).json({ message: 'Case is not assigned to this attorney' });
    }

    // Unassign case from attorney
    await attorney.unassignCase(caseId);

    // Update case to remove attorney assignment
    await Case.findByIdAndUpdate(caseId, { $unset: { assignedAttorney: 1 } });

    // Populate case info for response
    await attorney.populate('assignedCases', 'caseName caseNumber status');

    res.json({
      message: 'Case unassigned successfully',
      attorney
    });

  } catch (error) {
    console.error('Error unassigning case:', error);
    res.status(500).json({ message: 'Server error while unassigning case' });
  }
});

// Get attorney workload and statistics
router.get('/:id/workload', auth, async (req, res) => {
  try {
    const attorney = await Attorney.findById(req.params.id);
    if (!attorney) {
      return res.status(404).json({ message: 'Attorney not found' });
    }

    // Check access permissions
    if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
      return res.status(403).json({ message: 'Access denied to this attorney' });
    }

    const workload = attorney.getWorkload();

    // Get additional statistics
    const activeCases = await Case.countDocuments({
      assignedAttorney: attorney._id,
      status: { $in: ['Active', 'Pending'] }
    });

    const completedCases = await Case.countDocuments({
      assignedAttorney: attorney._id,
      status: 'Closed'
    });

    const result = {
      ...workload,
      activeCases,
      completedCases
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching attorney workload:', error);
    res.status(500).json({ message: 'Server error while fetching attorney workload' });
  }
});

// Get available attorneys for case assignment
router.get('/available/for-case', auth, async (req, res) => {
  try {
    const { caseId, practiceArea, maxCases = 10 } = req.query;

    // Determine firm ID
    let firmId = req.user.userId;
    if (req.user.role === 'lawyer' && req.user.firm) {
      firmId = req.user.firm;
    }

    const match = {
      firm: firmId,
      status: 'active',
      totalCases: { $lt: maxCases }
    };

    if (practiceArea) {
      match.practiceAreas = { $in: [practiceArea] };
    }

    const availableAttorneys = await Attorney.find(match)
      .select('firstName lastName email practiceAreas specialization experience totalCases hourlyRate')
      .sort({ totalCases: 1, lastName: 1 });

    res.json(availableAttorneys);

  } catch (error) {
    console.error('Error fetching available attorneys:', error);
    res.status(500).json({ message: 'Server error while fetching available attorneys' });
  }
});

// Bulk assign cases to attorneys
router.post('/bulk-assign', auth, async (req, res) => {
  try {
    const { assignments } = req.body; // Array of { attorneyId, caseId }

    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ message: 'Assignments array is required' });
    }

    const results = [];
    const errors = [];

    for (const assignment of assignments) {
      try {
        const { attorneyId, caseId } = assignment;

        const attorney = await Attorney.findById(attorneyId);
        if (!attorney) {
          errors.push({ caseId, error: 'Attorney not found' });
          continue;
        }

        // Check access permissions
        if (req.user.role === 'lawyer' && attorney.firm.toString() !== req.user.firm) {
          errors.push({ caseId, error: 'Access denied to attorney' });
          continue;
        }

        const caseDoc = await Case.findById(caseId);
        if (!caseDoc) {
          errors.push({ caseId, error: 'Case not found' });
          continue;
        }

        if (caseDoc.lawyer.toString() !== req.user.userId && req.user.role !== 'firm') {
          errors.push({ caseId, error: 'Access denied to case' });
          continue;
        }

        // Assign case
        await attorney.assignCase(caseId);
        caseDoc.assignedAttorney = attorney._id;
        await caseDoc.save();

        results.push({ caseId, attorneyId, success: true });

      } catch (error) {
        errors.push({ caseId: assignment.caseId, error: error.message });
      }
    }

    res.json({
      message: 'Bulk assignment completed',
      results,
      errors
    });

  } catch (error) {
    console.error('Error in bulk assignment:', error);
    res.status(500).json({ message: 'Server error while performing bulk assignment' });
  }
});

module.exports = router;
