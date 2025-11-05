const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

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


