const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Create a new invoice
router.post('/', auth, async (req, res) => {
    console.log('Received invoice data:', req.body);
  try {
    const { case: caseId, expenses, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({ message: 'Invalid case ID format' });
    }

    // Calculate totals
    const subtotal = expenses.reduce((acc, exp) => {
      if (exp.billable) {
        return acc + (exp.cost * exp.quantity);
      }
      return acc;
    }, 0);

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    const invoice = new Invoice({
      case: caseId,
      user: req.user.userId,
      date,
      expenses,
      subtotal,
      tax,
      total,
      status: 'Draft'
    });

    await invoice.save();

    // Populate case and user details
    await invoice.populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'user', select: 'firstName lastName' }
    ]);

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all invoices
router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get invoice statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const [totalStats, statusStats] = await Promise.all([
      // Get total amounts
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$total' },
            totalPaid: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0]
              }
            },
            totalOutstanding: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Outstanding'] }, '$total', 0]
              }
            }
          }
        }
      ]),
      // Get counts by status
      Invoice.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$total' }
          }
        }
      ])
    ]);

    res.json({
      totals: totalStats[0] || {
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0
      },
      byStatus: statusStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          total: stat.total
        };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error getting invoice stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent activity
router.get('/recent-activity', auth, async (req, res) => {
  try {
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName');

    const recentActivity = recentInvoices.map(invoice => ({
      id: invoice._id,
      action: invoice.status,
      date: invoice.createdAt,
      amount: invoice.total,
      case: invoice.case,
      user: invoice.user
    }));

    res.json(recentActivity);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update invoice
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, expenses, notes, paymentTerms, dueDate } = req.body;

    let updateData = {};

    // Only update fields that are provided
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (paymentTerms) updateData.paymentTerms = paymentTerms;
    if (dueDate) updateData.dueDate = dueDate;

    // Recalculate totals if expenses changed
    if (expenses) {
      const subtotal = expenses.reduce((acc, exp) => {
        if (exp.billable) {
          return acc + (exp.cost * exp.quantity);
        }
        return acc;
      }, 0);

      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;

      updateData = {
        ...updateData,
        expenses,
        subtotal,
        tax,
        total
      };
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'user', select: 'firstName lastName' }
    ]);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await invoice.remove();
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get invoice statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const [totalStats, statusStats] = await Promise.all([
      // Get total amounts
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: '$total' },
            totalPaid: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0]
              }
            },
            totalOutstanding: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Outstanding'] }, '$total', 0]
              }
            }
          }
        }
      ]),
      // Get counts by status
      Invoice.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$total' }
          }
        }
      ])
    ]);

    res.json({
      totals: totalStats[0] || {
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0
      },
      byStatus: statusStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          total: stat.total
        };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error getting invoice stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent activity
router.get('/recent-activity', auth, async (req, res) => {
  try {
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName');

    const recentActivity = recentInvoices.map(invoice => ({
      id: invoice._id,
      action: invoice.status,
      date: invoice.createdAt,
      amount: invoice.total,
      case: invoice.case,
      user: invoice.user
    }));

    res.json(recentActivity);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
