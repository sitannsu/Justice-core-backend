const express = require('express');
const router = express.Router();

// Test endpoint to send verification email
// POST /api/email/test-verification
// Body: { email: string, firstName?: string }
router.post('/test-verification', async (req, res) => {
  try {
    const { email, firstName } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    // Dynamically import ESM email service
    const { emailService } = await import('../services/email.service.js');

    const token = emailService.generateVerificationToken();
    const ok = await emailService.sendVerificationEmail(email, token, firstName || 'User');

    if (!ok) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    // Expose token in response to help with local testing
    return res.status(200).json({
      message: 'Verification email sent',
      token
    });
  } catch (error) {
    console.error('test-verification error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generic endpoint to send an email
// POST /api/email/send
// Body: { to: string, subject: string, html?: string, text?: string }
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body || {};

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ message: 'to, subject and html or text are required' });
    }

    const { emailService } = await import('../services/email.service.js');

    const ok = await emailService.sendEmail({
      to,
      subject,
      // Prefer html when provided, fall back to wrapping plain text
      html: html || `<pre>${String(text)}</pre>`
    });

    if (!ok) {
      return res.status(500).json({ message: 'Failed to send email' });
    }

    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('send email error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;












