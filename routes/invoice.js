const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Case = require('../models/Case');
const auth = require('../middleware/auth');
const clientAuth = require('../middleware/clientAuth');
const mongoose = require('mongoose');

// For lawyers: create invoice (simplified)
router.post('/', auth, async (req, res) => {
  try {
    const { case: caseId, expenses = [], date, notes, paymentTerms, dueDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({ message: 'Invalid case ID format' });
    }

    const subtotal = expenses.reduce((acc, exp) => {
      if (exp.billable) {
        const quantity = typeof exp.quantity === 'number' ? exp.quantity : 1;
        const cost = typeof exp.cost === 'number' ? exp.cost : 0;
        return acc + cost * quantity;
      }
      return acc;
    }, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    const invoiceDoc = new Invoice({
      case: caseId,
      user: req.user.userId,
      client: undefined,
      date,
      dueDate,
      expenses,
      subtotal,
      tax,
      total,
      status: 'Draft',
      notes,
      paymentTerms
    });

    if (!invoiceDoc.client && caseId) {
      const c = await Case.findById(caseId).select('clients');
      if (c && Array.isArray(c.clients) && c.clients.length > 0) {
        invoiceDoc.client = c.clients[0];
      }
    }

    await invoiceDoc.save();
    await invoiceDoc.populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'user', select: 'firstName lastName' }
    ]);

    res.status(201).json(invoiceDoc);
  } catch (e) {
    console.error('Error creating invoice:', e);
    if (e.name === 'ValidationError') {
      return res.status(400).json({ message: e.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// For lawyers: list invoices created by current user
router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user.userId })
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const [totalStats, statusStats] = await Promise.all([
      Invoice.aggregate([
        { $match: { user: userId } },
        { $group: {
          _id: null,
          totalInvoiced: { $sum: '$total' },
          totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0] } },
          totalOutstanding: { $sum: { $cond: [{ $eq: ['$status', 'Outstanding'] }, '$total', 0] } }
        }}
      ]),
      Invoice.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
      ])
    ]);

    res.json({
      totals: totalStats[0] || { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0 },
      byStatus: statusStats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, total: stat.total };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error getting invoice stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/recent-activity', auth, async (req, res) => {
  try {
    const recentInvoices = await Invoice.find({ user: req.user.userId })
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
// Client endpoints must come before ":id" to avoid route capture
// Client portal: list invoices by logged-in client
router.get('/client', clientAuth, async (req, res) => {
  try {
    const list = await Invoice.find({ client: req.user.id })
      .populate('case', 'caseName caseNumber')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Lawyer: Get invoices by client ID
router.get('/client/:clientId', auth, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }
    const invoices = await Invoice.find({ client: clientId })
      .populate('case', 'caseName caseNumber clients')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Error getting client invoices:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.userId })
      .populate('case', 'caseName caseNumber')
      .populate('user', 'firstName lastName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// Update invoice (PUT and PATCH)
async function updateInvoiceHandler(req, res) {
  try {
    const { status, expenses, notes, paymentTerms, dueDate } = req.body;
    let updateData = {};
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (paymentTerms) updateData.paymentTerms = paymentTerms;
    if (dueDate) updateData.dueDate = dueDate;

    if (expenses) {
      const subtotal = expenses.reduce((acc, exp) => {
        if (exp.billable) {
          const quantity = typeof exp.quantity === 'number' ? exp.quantity : 1;
          const cost = typeof exp.cost === 'number' ? exp.cost : 0;
          return acc + cost * quantity;
        }
        return acc;
      }, 0);
      const tax = subtotal * 0.1;
      const total = subtotal + tax;
      updateData = { ...updateData, expenses, subtotal, tax, total };
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { $set: updateData },
      { new: true }
    ).populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'user', select: 'firstName lastName' }
    ]);

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

router.put('/:id', auth, updateInvoiceHandler);
router.patch('/:id', auth, updateInvoiceHandler);

// Delete invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.userId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    await invoice.remove();
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
