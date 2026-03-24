const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Create a notice
router.post('/', auth, async (req, res) => {
    try {
        const {
            title, type, caseId, recipient, dateSent, dueDate,
            status, priority, content, notes
        } = req.body;

        const notice = new Notice({
            title,
            type,
            case: caseId && mongoose.Types.ObjectId.isValid(caseId) ? caseId : undefined,
            recipient,
            sender: req.user.userId,
            dateSent: dateSent || Date.now(),
            dueDate,
            status: status || 'Draft',
            priority: priority || 'Medium',
            content,
            notes
        });

        await notice.save();

        // Populate
        if (notice.case) {
            await notice.populate('case', 'caseName caseNumber');
        }

        res.status(201).json(notice);
    } catch (error) {
        console.error('Error creating notice:', error);
        res.status(500).json({ message: 'Server error creating notice' });
    }
});

// Get all notices
router.get('/', auth, async (req, res) => {
    try {
        const { status, type } = req.query;
        const filter = { sender: req.user.userId };
        if (status) filter.status = status;
        if (type) filter.type = type;

        const notices = await Notice.find(filter)
            .populate('case', 'caseName caseNumber')
            .sort({ createdAt: -1 });

        res.json(notices);
    } catch (error) {
        console.error('Error fetching notices:', error);
        res.status(500).json({ message: 'Server error fetching notices' });
    }
});

// Get notice stats
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.userId);

        const stats = await Notice.aggregate([
            { $match: { sender: userId } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    drafts: { $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] } },
                    sent: { $sum: { $cond: [{ $eq: ['$status', 'Sent'] }, 1, 0] } },
                    delivered: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] } },
                    responded: { $sum: { $cond: [{ $eq: ['$status', 'Responded'] }, 1, 0] } },
                    overdue: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] } }
                }
            }
        ]);

        res.json(stats[0] || {
            total: 0, drafts: 0, sent: 0, delivered: 0, responded: 0, overdue: 0
        });
    } catch (error) {
        console.error('Error fetching notice stats:', error);
        res.status(500).json({ message: 'Server error fetching notice stats' });
    }
});

// Get single notice
router.get('/:id', auth, async (req, res) => {
    try {
        const notice = await Notice.findOne({ _id: req.params.id, sender: req.user.userId })
            .populate('case', 'caseName caseNumber');

        if (!notice) return res.status(404).json({ message: 'Notice not found' });

        res.json(notice);
    } catch (error) {
        console.error('Error fetching notice:', error);
        res.status(500).json({ message: 'Server error fetching notice' });
    }
});

// Update notice
router.put('/:id', auth, async (req, res) => {
    try {
        const notice = await Notice.findOne({ _id: req.params.id, sender: req.user.userId });
        if (!notice) return res.status(404).json({ message: 'Notice not found' });

        const updates = req.body;
        Object.keys(updates).forEach(key => {
            // Prevent updating sender or protected fields if necessary
            if (key !== 'sender' && key !== '_id' && key !== 'createdAt') {
                notice[key] = updates[key];
            }
        });

        await notice.save();
        res.json(notice);
    } catch (error) {
        console.error('Error updating notice:', error);
        res.status(500).json({ message: 'Server error updating notice' });
    }
});

// Delete notice
router.delete('/:id', auth, async (req, res) => {
    try {
        const notice = await Notice.findOneAndDelete({ _id: req.params.id, sender: req.user.userId });
        if (!notice) return res.status(404).json({ message: 'Notice not found' });
        res.json({ message: 'Notice deleted successfully' });
    } catch (error) {
        console.error('Error deleting notice:', error);
        res.status(500).json({ message: 'Server error deleting notice' });
    }
});

module.exports = router;
