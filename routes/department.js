const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Department = require('../models/Department');
const Position = require('../models/Position');
const UserDepartment = require('../models/UserDepartment');
const User = require('../models/User');

// Get all departments for the current tenant
router.get('/', auth, async (req, res) => {
  try {
    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const departments = await Department.find({ 
      tenant_id: user.tenant_id || 'default',
      is_active: true 
    }).populate('head_of_department_id', 'firstName lastName email');

    // Get member count for each department
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const memberCount = await UserDepartment.countDocuments({
          department_id: dept._id,
          is_active: true
        });

        // For now, set active cases count to 0 (can be implemented later)
        const activeCasesCount = 0;

        return {
          ...dept.toObject(),
          member_count: memberCount,
          active_cases_count: activeCasesCount
        };
      })
    );

    res.json(departmentsWithCounts);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

// Create a new department
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, department_type, parent_department_id, head_of_department_id } = req.body;

    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const department = new Department({
      name,
      description,
      department_type,
      parent_department_id,
      head_of_department_id,
      tenant_id: user.tenant_id || 'default',
      created_by: req.user.userId
    });

    await department.save();
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ message: 'Failed to create department' });
  }
});

// Update a department
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, department_type, parent_department_id, head_of_department_id } = req.body;

    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const department = await Department.findOneAndUpdate(
      { 
        _id: req.params.id, 
        tenant_id: user.tenant_id || 'default' 
      },
      {
        name,
        description,
        department_type,
        parent_department_id,
        head_of_department_id
      },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ message: 'Failed to update department' });
  }
});

// Delete a department (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const department = await Department.findOneAndUpdate(
      { 
        _id: req.params.id, 
        tenant_id: user.tenant_id || 'default' 
      },
      { is_active: false },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ message: 'Failed to delete department' });
  }
});

// Get all positions for the current tenant
router.get('/positions', auth, async (req, res) => {
  try {
    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const positions = await Position.find({ 
      tenant_id: user.tenant_id || 'default',
      is_active: true 
    });

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ message: 'Failed to fetch positions' });
  }
});

// Create a new position
router.post('/positions', auth, async (req, res) => {
  try {
    const { title, level, description, base_hourly_rate, is_billable, permissions } = req.body;

    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const position = new Position({
      title,
      level,
      description,
      base_hourly_rate,
      is_billable: is_billable ?? true,
      permissions: permissions || {},
      tenant_id: user.tenant_id || 'default',
      created_by: req.user.userId
    });

    await position.save();
    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ message: 'Failed to create position' });
  }
});

// Assign user to department
router.post('/assign-user', auth, async (req, res) => {
  try {
    const { user_id, department_id, position_id, is_primary } = req.body;

    // Get user's tenant_id from the user document
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if assignment already exists
    const existingAssignment = await UserDepartment.findOne({
      user_id,
      department_id,
      is_active: true
    });

    if (existingAssignment) {
      return res.status(400).json({ message: 'User is already assigned to this department' });
    }

    const userDepartment = new UserDepartment({
      user_id,
      department_id,
      position_id,
      is_primary: is_primary || false,
      tenant_id: currentUser.tenant_id || 'default'
    });

    await userDepartment.save();
    res.status(201).json(userDepartment);
  } catch (error) {
    console.error('Error assigning user to department:', error);
    res.status(500).json({ message: 'Failed to assign user to department' });
  }
});

// Get user department assignments
router.get('/user-assignments', auth, async (req, res) => {
  try {
    // Get user's tenant_id from the user document
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const assignments = await UserDepartment.find({ 
      tenant_id: user.tenant_id || 'default',
      is_active: true 
    })
    .populate('user_id', 'firstName lastName email')
    .populate('department_id', 'name department_type')
    .populate('position_id', 'title level');

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching user assignments:', error);
    res.status(500).json({ message: 'Failed to fetch user assignments' });
  }
});

module.exports = router;
