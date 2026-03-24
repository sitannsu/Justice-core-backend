const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Create Expense
router.post('/', auth, async (req, res) => {
    try {
        const { description, amount, date, category, matter, billable, notes } = req.body;

        // Validate required fields
        if (!description || !amount || !date || !category) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const expense = new Expense({
            description,
            amount,
            date,
            category,
            case: matter && mongoose.Types.ObjectId.isValid(matter) ? matter : undefined,
            user: req.user.userId, // From auth middleware
            billable: billable !== undefined ? billable : true,
            notes
        });

        await expense.save();

        // Populate case info if present
        if (expense.case) {
            await expense.populate('case', 'caseName caseNumber');
        }

        res.status(201).json(expense);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ message: 'Server error creating expense' });
    }
});

// Get Expenses
router.get('/', auth, async (req, res) => {
    try {
        const expenses = await Expense.find({ user: req.user.userId })
            .populate('case', 'caseName caseNumber')
            .sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Server error fetching expenses' });
    }
});

// Get Expense Stats
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);

        const stats = await Expense.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    totalCount: { $sum: 1 },
                    billableAmount: { $sum: { $cond: ['$billable', '$amount', 0] } },
                    nonBillableAmount: { $sum: { $cond: ['$billable', 0, '$amount'] } },
                    pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                    approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } }
                }
            }
        ]);

        res.json(stats[0] || {
            totalAmount: 0,
            totalCount: 0,
            billableAmount: 0,
            nonBillableAmount: 0,
            pendingCount: 0,
            approvedCount: 0
        });
    } catch (error) {
        console.error('Error fetching expense stats:', error);
        res.status(500).json({ message: 'Server error fetching stats' });
    }
});

module.exports = router;
