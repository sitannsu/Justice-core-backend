const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Document = require('../models/Document');
const Case = require('../models/Case');
const clientAuth = require('../middleware/clientAuth');
const { upload } = require('../config/multer-s3.config');

// Client: Get documents for their case
router.get('/case/:caseId', clientAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Verify client has access to this case
    const caseDoc = await Case.findOne({ 
      _id: caseId, 
      clients: req.user.id 
    });
    
    if (!caseDoc) {
      return res.status(403).json({ message: 'Access denied: You are not a client on this case.' });
    }
    
    const documents = await Document.find({ 
      case: caseId, 
      status: { $ne: 'deleted' } 
    }).sort({ createdAt: -1 });
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Client: Upload document to their case
router.post('/upload', clientAuth, upload.single('file'), async (req, res) => {
  try {
    const { caseId, documentType, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Verify client has access to this case
    const caseDoc = await Case.findOne({ 
      _id: caseId, 
      clients: req.user.id 
    });
    
    if (!caseDoc) {
      return res.status(403).json({ message: 'Access denied: You are not a client on this case.' });
    }
    
    const document = new Document({
      filename: req.file.key || req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.location || req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      case: caseId,
      uploadedBy: req.user.id,
      documentType: documentType || 'client_document',
      description: description || 'Uploaded by client',
      status: 'active',
      s3Bucket: req.file.bucket || 'local',
      s3Key: req.file.key || req.file.filename
    });
    
    await document.save();
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
