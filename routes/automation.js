const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const AutomatedDocument = require('../models/AutomatedDocument');

// Trigger automation for a document (mock AI for now)
router.post('/process/:documentId', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId).populate('case', 'lawyer');
    if (!document) return res.status(404).json({ message: 'Document not found' });
    // only the owning lawyer
    if (String(document.case.lawyer) !== req.user.userId) return res.status(403).json({ message: 'Access denied' });

    // Mock classification/ocr/extraction
    const docType = document.originalName.toLowerCase().includes('contract') ? 'Contract' : (document.documentType || 'General');
    const ocrText = `OCR placeholder for ${document.originalName}`;
    const clauses = [
      { title: 'Payment Terms', text: 'Payment within 30 days of invoice.', risk: 'medium' },
      { title: 'Termination', text: 'Either party may terminate with 30 days notice.', risk: 'low' }
    ];
    const references = [
      { type: 'BareAct', citation: 'Indian Contract Act, 1872, Section 73', link: 'https://indiankanoon.org/doc/1649167/' },
      { type: 'CaseLaw', citation: 'ONGC v. Saw Pipes, (2003) 5 SCC 705', link: 'https://indiankanoon.org/doc/1034491/' }
    ];

    const autoDoc = await AutomatedDocument.findOneAndUpdate(
      { document: document._id },
      { document: document._id, case: document.case._id, lawyer: req.user.userId, docType, ocrText, clauses, references, tags: [docType] },
      { upsert: true, new: true }
    );

    res.json(autoDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to process document' });
  }
});

// Get processed documents
router.get('/documents', auth, async (req, res) => {
  try {
    const list = await AutomatedDocument.find({ lawyer: req.user.userId }).populate('document', 'originalName fileSize createdAt');
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// Search by clause or reference
router.get('/search', auth, async (req, res) => {
  try {
    const { q, type } = req.query;
    const filter = { lawyer: req.user.userId };
    if (type) filter.docType = type;
    if (q) filter.$or = [
      { 'clauses.title': new RegExp(q, 'i') },
      { 'clauses.text': new RegExp(q, 'i') },
      { 'references.citation': new RegExp(q, 'i') },
      { ocrText: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') }
    ];
    const list = await AutomatedDocument.find(filter).limit(50);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Search failed' });
  }
});

module.exports = router;


