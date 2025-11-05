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
    const memos = await VoiceMemo.find({ case: caseId }).sort({ createdAt: -1 });
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
    if (String(memo.case.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied' });
    const { title, description, status } = req.body;
    if (title !== undefined) memo.title = title;
    if (description !== undefined) memo.description = description;
    if (status !== undefined) memo.status = status;
    await memo.save();
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: 'Server error while updating memo' });
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


