const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const User = require('../models/User');

// GET dashboard data
router.get('/dashboard', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const totalEmployees = await Employee.countDocuments({ tenant_id: tenantId, status: 'Active' });

        // For "Present Today", we check attendance for today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const presentToday = await Attendance.countDocuments({
            tenant_id: tenantId,
            date: { $gte: today },
            punch_in: { $exists: true }
        });

        const pendingLeaves = await Leave.countDocuments({
            tenant_id: tenantId,
            status: 'Pending'
        });

        // Mock payroll ready value
        const payrollReady = (totalEmployees * 0.5).toFixed(1);

        const absentEmployees = []; // Could populate based on present vs total
        const lateEmployees = []; // Could populate based on punch_in time

        res.json({
            stats: {
                totalEmployees,
                presentToday,
                pendingLeaves,
                payrollReady
            },
            todayHighlights: {
                presentToday,
                absentToday: totalEmployees - presentToday,
                lateArrivals: 0,
                totalHours: presentToday * 8 // Mock value
            },
            absentEmployees,
            lateEmployees,
            systemStatus: {
                active: true,
                realTime: true,
                lastUpdate: new Date().toLocaleTimeString()
            }
        });
    } catch (error) {
        console.error('Error fetching HR dashboard:', error);
        res.status(500).json({ message: 'Failed to fetch HR dashboard' });
    }
});

// GET all employees
router.get('/employees', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const { status, department } = req.query;
        const filter = { tenant_id: tenantId };
        if (status) filter.status = status;
        if (department) filter.department = department;

        const employees = await Employee.find(filter).sort({ createdAt: -1 });
        res.json({ employees });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ message: 'Failed to fetch employees' });
    }
});

// POST new employee
router.post('/employees', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const employeeData = {
            ...req.body,
            tenant_id: tenantId,
            created_by: req.user.userId
        };

        const employee = new Employee(employeeData);
        await employee.save();
        res.status(201).json(employee);
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ message: error.message || 'Failed to create employee' });
    }
});

// GET attendance records
router.get('/attendance', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const { date, employee_id } = req.query;
        const filter = { tenant_id: tenantId };
        if (date) {
            const queryDate = new Date(date);
            queryDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(queryDate);
            nextDay.setDate(nextDay.getDate() + 1);
            filter.date = { $gte: queryDate, $lt: nextDay };
        }
        if (employee_id) filter.employee_id = employee_id;

        const attendance = await Attendance.find(filter)
            .populate('employee_id')
            .sort({ date: -1 });
        res.json({ attendance });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ message: 'Failed to fetch attendance' });
    }
});

// POST punch-in
router.post('/attendance/punch-in', auth, async (req, res) => {
    try {
        const { employee_id, location } = req.body;
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let record = await Attendance.findOne({
            employee_id,
            date: { $gte: today },
            tenant_id: tenantId
        });

        if (record && record.punch_in) {
            return res.status(400).json({ message: 'Already punched in for today' });
        }

        if (!record) {
            record = new Attendance({
                employee_id,
                date: today,
                tenant_id: tenantId,
                punch_in: new Date(),
                location,
                status: 'Present'
            });
        } else {
            record.punch_in = new Date();
            record.location = location;
        }

        await record.save();
        res.json(record);
    } catch (error) {
        console.error('Punch in error:', error);
        res.status(500).json({ message: 'Failed to punch in' });
    }
});

// PUT punch-out
router.put('/attendance/punch-out', auth, async (req, res) => {
    try {
        const { employee_id, location } = req.body;
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const record = await Attendance.findOne({
            employee_id,
            date: { $gte: today },
            tenant_id: tenantId
        });

        if (!record || !record.punch_in) {
            return res.status(400).json({ message: 'No punch-in record found for today' });
        }

        record.punch_out = new Date();
        const diffMs = record.punch_out - record.punch_in;
        record.total_hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        await record.save();
        res.json(record);
    } catch (error) {
        console.error('Punch out error:', error);
        res.status(500).json({ message: 'Failed to punch out' });
    }
});

// GET leaves
router.get('/leaves', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const { status, employee_id } = req.query;
        const filter = { tenant_id: tenantId };
        if (status) filter.status = status;
        if (employee_id) filter.employee_id = employee_id;

        const leaves = await Leave.find(filter).populate('employee_id').sort({ applied_date: -1 });
        res.json({ leaves });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ message: 'Failed to fetch leaves' });
    }
});

// POST leave application
router.post('/leaves', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const tenantId = user?.tenant_id || 'default';

        const leaveData = {
            ...req.body,
            tenant_id: tenantId
        };

        const leave = new Leave(leaveData);
        await leave.save();
        res.status(201).json(leave);
    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ message: 'Failed to apply for leave' });
    }
});

// PUT update leave status
router.put('/leaves/:id/status', auth, async (req, res) => {
    try {
        const { status, rejection_reason } = req.body;
        const leave = await Leave.findById(req.params.id);

        if (!leave) return res.status(404).json({ message: 'Leave record not found' });

        leave.status = status;
        if (rejection_reason) leave.rejection_reason = rejection_reason;
        leave.approved_by = req.user.userId;
        leave.approved_date = new Date();

        await leave.save();
        res.json({ message: `Leave ${status} successfully`, leave });
    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ message: 'Failed to update leave status' });
    }
});

module.exports = router;
