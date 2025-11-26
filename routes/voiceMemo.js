const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const VoiceMemo = require('../models/VoiceMemo');
const Case = require('../models/Case');
const clientAuth = require('../middleware/clientAuth');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/voice-memos';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, 'memo-' + uniqueSuffix + ext);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Create/upload memo
router.post('/upload', auth, upload.single('audio'), async (req, res) => {
  try {
    const { caseId, title, description, duration, uploaderRole } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No audio file uploaded' });

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ message: 'Case not found' });
    if (String(caseDoc.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied to this case' });

    const memo = await VoiceMemo.create({
      filename: req.file.filename,
      originalName: req.file.originalname || req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || 'audio/webm',
      duration: Number(duration || 0),
      case: caseId,
      uploaderRole: uploaderRole || 'lawyer',
      uploader: req.user.userId,
      title: title || 'Voice Memo',
      description: description || '',
    });

    await memo.populate([{ path: 'case', select: 'caseName caseNumber' }]);

    res.status(201).json(memo);
  } catch (err) {
    console.error('Voice memo upload error:', err);
    res.status(500).json({ message: 'Server error while uploading memo' });
  }
});

// Create transcript-only memo (no audio file required)
router.post('/transcript', auth, async (req, res) => {
  try {
    const { caseId, title, description, transcript, uploaderRole } = req.body;

    // If a caseId is provided, validate ownership
    if (caseId) {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) return res.status(404).json({ message: 'Case not found' });
      if (String(caseDoc.lawyer) !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied to this case' });
      }
    }

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ message: 'Transcript text is required' });
    }

    const memo = await VoiceMemo.create({
      case: caseId || undefined,
      uploaderRole: uploaderRole || 'lawyer',
      uploader: req.user.userId,
      title: title || 'Transcript',
      description: description || '',
      transcript: transcript.trim(),
      duration: 0
    });

    res.status(201).json(memo);
  } catch (err) {
    console.error('Transcript creation error:', err);
    res.status(500).json({ message: 'Server error while saving transcript' });
  }
});

// List memos created by current user
router.get('/mine', auth, async (req, res) => {
  try {
    const memos = await VoiceMemo.find({ uploader: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(memos);
  } catch (err) {
    console.error('Fetch my memos error:', err);
    res.status(500).json({ message: 'Server error while fetching memos' });
  }
});

// List memos for a case
router.get('/case/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ message: 'Case not found' });
    if (String(caseDoc.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied' });
    const memos = await VoiceMemo.find({ case: caseId }).sort({ createdAt: -1 });
    res.json(memos);
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching memos' });
  }
});

// Client access to memos of a case they belong to
router.get('/client/case/:caseId', clientAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ message: 'Case not found' });
    // Check that this client is attached to case
    if (!caseDoc.clients.map((c) => String(c)).includes(req.user.clientId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Only return memos explicitly shared with clients
    const memos = await VoiceMemo.find({ case: caseId, sharedWithClients: true })
      .sort({ createdAt: -1 });
    res.json(memos);
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching memos' });
  }
});

// Client download
router.get('/client/download/:id', clientAuth, async (req, res) => {
  try {
    const memo = await VoiceMemo.findById(req.params.id).populate('case', 'clients');
    if (!memo) return res.status(404).json({ message: 'Not found' });
    if (!memo.case.clients.map((c) => String(c)).includes(req.user.clientId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (!fs.existsSync(memo.filePath)) return res.status(404).json({ message: 'File missing' });
    res.setHeader('Content-Type', memo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${memo.originalName}"`);
    fs.createReadStream(memo.filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Server error while downloading memo' });
  }
});

// Download
router.get('/download/:id', auth, async (req, res) => {
  try {
    const memo = await VoiceMemo.findById(req.params.id).populate('case', 'lawyer');
    if (!memo) return res.status(404).json({ message: 'Not found' });
    if (String(memo.case.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied' });
    if (!fs.existsSync(memo.filePath)) return res.status(404).json({ message: 'File missing' });
    res.setHeader('Content-Type', memo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${memo.originalName}"`);
    fs.createReadStream(memo.filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Server error while downloading memo' });
  }
});

// Update status/title/description
router.put('/:id', auth, async (req, res) => {
  try {
    const memo = await VoiceMemo.findById(req.params.id).populate('case', 'lawyer');
    if (!memo) return res.status(404).json({ message: 'Not found' });
    if (memo.case && String(memo.case.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied' });
    const { title, description, status, transcript } = req.body;
    if (title !== undefined) memo.title = title;
    if (description !== undefined) memo.description = description;
    if (status !== undefined) memo.status = status;
    if (transcript !== undefined) memo.transcript = transcript;
    await memo.save();
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: 'Server error while updating memo' });
  }
});

// Toggle share with clients
router.put('/:id/share', auth, async (req, res) => {
  try {
    const { shared, notify } = req.body; // boolean
    const memo = await VoiceMemo.findById(req.params.id).populate('case', 'lawyer clients caseName');
    if (!memo) return res.status(404).json({ message: 'Not found' });
    // Only owner can toggle; if linked to a case, lawyer must match
    if (memo.case && String(memo.case.lawyer) !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    memo.sharedWithClients = !!shared;
    await memo.save();

    let notified = 0;
    let note = undefined;
    if (memo.sharedWithClients && notify && memo.case) {
      try {
        // Try to email all clients on the case, if mail creds exist
        const hasCreds = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
        if (!hasCreds) {
          note = 'Email not configured; clients can view in portal.';
        } else {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          });
          // Load client emails
          const caseDoc = await Case.findById(memo.case._id).populate('clients', 'email contactPerson');
          const emails = (caseDoc?.clients || []).map((c) => c.email).filter(Boolean);
          if (emails.length > 0) {
            const link = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/client/voice-memos?caseId=${String(memo.case._id)}`;
            const html = `
              <div style="font-family:Arial, Helvetica, sans-serif">
                <h2>New Voice Note Shared</h2>
                <p>Your legal team shared a new voice note on case: <strong>${caseDoc.caseName || ''}</strong>.</p>
                <p>You can access it securely in your client portal.</p>
                <p><a href="${link}" style="padding:10px 16px;background:#6b46c1;color:#fff;border-radius:6px;text-decoration:none">Open Client Portal</a></p>
              </div>
            `;
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
              to: emails.join(','),
              subject: 'New voice note shared with you',
              html
            });
            notified = emails.length;
          } else {
            note = 'No client emails found on the case.';
          }
        }
      } catch (mailErr) {
        console.error('Voice memo share mail error:', mailErr);
        note = 'Failed to send email; clients can still view in portal.';
      }
    } else if (memo.sharedWithClients && notify && !memo.case) {
      note = 'Attach transcript to a case to notify clients.';
    }

    res.json({ id: memo._id, sharedWithClients: memo.sharedWithClients, notified, note });
  } catch (err) {
    console.error('Share toggle error:', err);
    res.status(500).json({ message: 'Server error while updating sharing' });
  }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const memo = await VoiceMemo.findById(req.params.id).populate('case', 'lawyer');
    if (!memo) return res.status(404).json({ message: 'Not found' });
    if (String(memo.case.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied' });
    if (fs.existsSync(memo.filePath)) fs.unlinkSync(memo.filePath);
    await memo.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error while deleting memo' });
  }
});

module.exports = router;


