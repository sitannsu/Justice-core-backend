const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const clientAuth = require('../middleware/clientAuth');
const Invoice = require('../models/Invoice');

// Razorpay order creation
router.post('/razorpay/order', auth, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    if (!amount) return res.status(400).json({ message: 'amount is required (in paise)' });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      // Fallback to mock order but inform caller; Checkout may 401 with placeholder key
      const mock = { id: `order_${Date.now()}`, amount, currency, receipt: receipt || `rcpt_${Date.now()}` };
      return res.json({ order: mock, warning: 'Razorpay keys missing on server. Using mock order; Checkout may fail. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
    }

    const Razorpay = require('razorpay');
    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await instance.orders.create({ amount, currency, receipt });
    res.json({ order });
  } catch (e) {
    console.error('Razorpay order error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

// Client portal: create Razorpay order for a specific invoice
// Uses clientAuth and derives amount from the invoice total
router.post('/razorpay/invoice-order', clientAuth, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ message: 'invoiceId is required' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const amount = Math.round(invoice.total * 100); // paise
    const currency = 'INR';
    const receipt = `inv_${invoice.invoiceNumber || invoice._id.toString()}`;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      const mock = { id: `order_${Date.now()}`, amount, currency, receipt };
      return res.json({ order: mock, warning: 'Razorpay keys missing on server. Using mock order; Checkout may fail. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
    }

    const Razorpay = require('razorpay');
    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await instance.orders.create({ amount, currency, receipt, notes: { invoiceId: invoice._id.toString() } });
    res.json({ order });
  } catch (e) {
    console.error('Razorpay invoice order error:', e);
    res.status(500).json({ message: e.message });
  }
});


router.post('/razorpay/payment-done', clientAuth, async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ message: 'invoiceId is required' });
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    invoice.status = 'Paid';

    if (Array.isArray(invoice.expenses)) {
      invoice.expenses.forEach((exp) => {
        exp.paid = true;
      });
    }

    await invoice.save();

    res.json({ message: 'Invoice marked as paid', invoice });
  } catch (e) {
    console.error('Razorpay payment done error:', e);
    res.status(500).json({ message: e.message });
  }
});


