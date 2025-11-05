const express = require('express');
const mongoose = require('mongoose');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const Case = require('../models/Case');
const { upload, s3Client, s3Config } = require('../config/multer-s3.config');
const statsService = require('../services/stats.service');

const router = express.Router();

// Step 1: Upload file to get file URL/ID (without metadata)
router.post('/upload-file', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Generate unique file ID
    const fileId = new mongoose.Types.ObjectId();
    
    // Auto-detect file category based on MIME type
    const getFileCategory = (mimeType) => {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
      if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) return 'document';
      return 'other';
    };

    // Create temporary file record (will be updated when metadata is saved)
    const tempDocument = new Document({
      _id: fileId,
      filename: req.file.key, // S3 key
      originalName: req.file.originalname,
      filePath: req.file.location, // S3 URL
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.userId,
      status: 'temp', // Temporary status until metadata is saved
      s3Bucket: req.file.bucket,
      s3Key: req.file.key,
      fileCategory: getFileCategory(req.file.mimetype),
      processingStatus: 'completed'
    });

    await tempDocument.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      fileId: fileId.toString(),
      fileUrl: req.file.location, // S3 URL
      fileName: req.file.originalname
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    
    res.status(500).json({ message: 'Server error while uploading file' });
  }
});

// Step 2: Save document metadata with file ID
router.post('/save', auth, async (req, res) => {
  try {
    const { fileId, fileUrl, fileName, caseId, documentType, description, tags, notes } = req.body;

    if (!fileId || !caseId) {
      return res.status(400).json({ message: 'File ID and Case ID are required' });
    }

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    // Find and update the temporary document with metadata
    const document = await Document.findById(fileId);
    if (!document) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (document.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }

    // Update document with metadata
    document.case = caseId;
    document.documentType = documentType || 'other';
    document.description = description || '';
    document.tags = tags || [];
    document.notes = notes || '';
    document.status = 'active'; // Mark as active now that metadata is saved
    
    // Set additional metadata
    document.fileCategory = document.fileCategory || 'document';
    document.processingStatus = 'completed';
    document.aiAnalysisStatus = 'not_analyzed';
    document.gptQueries = 0;

    // Validate that required fields are present before saving
    if (!document.case) {
      return res.status(400).json({ message: 'Case ID is required to finalize document' });
    }

    await document.save();

    // Update stats after document is saved
    await statsService.updateStatsOnDocumentUpload(req.user.userId, document);

    // Populate case and user info for response
    await document.populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'uploadedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      message: 'Document metadata saved successfully',
      document
    });

  } catch (error) {
    console.error('Error saving document metadata:', error);
    res.status(500).json({ message: 'Server error while saving document metadata' });
  }
});

// Upload document (legacy method - combines both steps)
router.post('/upload', auth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { caseId, documentType, description, tags } = req.body;

    if (!caseId) {
      return res.status(400).json({ message: 'Case ID is required' });
    }

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Check if user has access to this case
    if (caseDoc.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const document = new Document({
      filename: req.file.key, // S3 key
      originalName: req.file.originalname,
      filePath: req.file.location, // S3 URL
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      case: caseId,
      uploadedBy: req.user.userId,
      documentType: documentType || 'other',
      description: description || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      folder: '',
      s3Bucket: req.file.bucket,
      s3Key: req.file.key
    });

    await document.save();

    // Populate case and user info for response
    await document.populate([
      { path: 'case', select: 'caseName caseNumber' },
      { path: 'uploadedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document
    });

  } catch (error) {
    console.error('Error uploading document:', error);

    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error while uploading document' });
  }
});

// Get all documents for the logged-in lawyer (by lawyerId in token)
router.get('/', auth, async (req, res) => {
  try {
    // Find all cases owned by this lawyer
    const caseIds = await Case.find({ lawyer: req.user.userId }).select('_id');
    const idList = caseIds.map((c) => c._id);

    // Fetch documents across these cases
    const documents = await Document.find({
      case: { $in: idList },
      status: { $ne: 'deleted' }
    })
      .populate('case', 'caseName caseNumber')
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Calculate storage statistics
    const totalFiles = documents.length;
    const totalSizeBytes = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const limitBytes = 5 * 1024 * 1024 * 1024; // 5 GB
    const usedPercent = Math.min(100, Math.round((totalSizeBytes / limitBytes) * 100));

    // Add statistics to response
    const response = {
      documents,
      statistics: {
        totalFiles,
        totalSizeBytes,
        totalSizeFormatted: formatBytes(totalSizeBytes),
        limitBytes,
        usedPercent,
        remainingBytes: Math.max(limitBytes - totalSizeBytes, 0)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching documents for lawyer:', error);
    res.status(500).json({ message: 'Server error while fetching documents' });
  }
});



// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get comprehensive statistics for dashboard
router.get('/stats/dashboard', auth, async (req, res) => {
  try {
    const stats = await statsService.getOverallStats(req.user.userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Server error while getting dashboard stats' });
  }
});

// Get storage usage summary for the logged-in lawyer
router.get('/usage', auth, async (req, res) => {
  try {
    const caseIds = await Case.find({ lawyer: req.user.userId }).select('_id');
    const idList = caseIds.map((c) => c._id);

    const [agg] = await Document.aggregate([
      { $match: { case: { $in: idList }, status: { $ne: 'deleted' } } },
      { $group: { _id: null, totalFiles: { $sum: 1 }, totalSizeBytes: { $sum: '$fileSize' } } }
    ]);

    const totalFiles = agg?.totalFiles || 0;
    const totalSizeBytes = agg?.totalSizeBytes || 0;
    const limitBytes = 5 * 1024 * 1024 * 1024; // 5 GB
    const remainingBytes = Math.max(limitBytes - totalSizeBytes, 0);
    const usedPercent = limitBytes ? Math.min(100, Math.round((totalSizeBytes / limitBytes) * 100)) : 0;

    res.json({ totalFiles, totalSizeBytes, limitBytes, usedPercent, remainingBytes });
  } catch (error) {
    console.error('Error computing document usage:', error);
    res.status(500).json({ message: 'Server error while computing document usage' });
  }
});

// Get documents for a case
router.get('/case/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const documents = await Document.find({ 
      case: caseId, 
      status: { $ne: 'deleted' } 
    })
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

    res.json(documents);

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Server error while fetching documents' });
  }
});

// Preview document (inline display) - accepts token as query param for preview
router.get('/preview/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { token } = req.query;

    // Validate token manually for preview
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify token manually (this is a simplified approach for preview)
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token is expired
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return res.status(401).json({ message: 'Token expired' });
      }
      
      req.user = { userId: decoded.userId };
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return res.status(401).json({ message: 'Invalid token' });
    }

    const document = await Document.findById(documentId).populate('case', 'lawyer');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check access permissions
    if (document.case.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this document' });
    }

    // Check if file is stored in S3
    if (document.s3Bucket && document.s3Key) {
      try {
        // Generate signed URL for S3 preview (inline display)
        const command = new GetObjectCommand({
          Bucket: document.s3Bucket,
          Key: document.s3Key,
        });
        
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
        
        // For preview, we'll redirect to the signed URL but with inline disposition
        res.redirect(signedUrl);
        return;
      } catch (s3Error) {
        console.error('Error generating S3 signed URL for preview:', s3Error);
        return res.status(500).json({ message: 'Error accessing file from S3' });
      }
    } else {
      // Legacy local file handling (fallback)
      const fs = require('fs');
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }

      // Set headers for inline preview (not download)
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
      res.setHeader('Content-Length', document.fileSize);

      // Stream the file for preview
      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('Error previewing document:', error);
    res.status(500).json({ message: 'Server error while previewing document' });
  }
});

// Download document
router.get('/download/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(documentId).populate('case', 'lawyer');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check access permissions
    if (document.case.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this document' });
    }

    // Check if file is stored in S3
    if (document.s3Bucket && document.s3Key) {
      try {
        // Generate signed URL for S3 download
        const command = new GetObjectCommand({
          Bucket: document.s3Bucket,
          Key: document.s3Key,
        });
        
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
        
        // Redirect to signed URL
        res.redirect(signedUrl);
        return;
      } catch (s3Error) {
        console.error('Error generating S3 signed URL:', s3Error);
        return res.status(500).json({ message: 'Error accessing file from S3' });
      }
    } else {
      // Legacy local file handling (fallback)
      const fs = require('fs');
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }

      // Set headers for download
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      res.setHeader('Content-Length', document.fileSize);

      // Stream the file
      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Server error while downloading document' });
  }
});

// Update document metadata
router.put('/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { documentType, description, tags, isPublic, folder } = req.body;

    const document = await Document.findById(documentId).populate('case', 'lawyer');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check access permissions
    if (document.case.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this document' });
    }

    // Update allowed fields
    if (documentType) document.documentType = documentType;
    if (description !== undefined) document.description = description;
    if (tags !== undefined) document.tags = tags;
    if (isPublic !== undefined) document.isPublic = isPublic;
    if (folder !== undefined) document.folder = folder;

    await document.save();

    res.json({
      message: 'Document updated successfully',
      document
    });

  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Server error while updating document' });
  }
});

// Delete document (soft delete)
router.delete('/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(documentId).populate('case', 'lawyer');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check access permissions
    if (document.case.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this document' });
    }

    // Soft delete - mark as deleted
    document.status = 'deleted';
    await document.save();

    res.json({ message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Server error while deleting document' });
  }
});

// Update GPT queries count for a document
router.post('/:documentId/gpt-query', auth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { queryCount = 1 } = req.body;

    const document = await Document.findById(documentId).populate('case', 'lawyer');
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check access permissions
    if (document.case.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this document' });
    }

    // Update GPT queries count
    document.gptQueries = (document.gptQueries || 0) + queryCount;
    document.lastGptQuery = new Date();
    document.aiAnalysisStatus = 'analyzed';

    await document.save();

    // Update stats after GPT query
    await statsService.updateStatsOnGptQuery(req.user.userId, documentId, queryCount);

    res.json({
      message: 'GPT queries count updated successfully',
      document: {
        _id: document._id,
        gptQueries: document.gptQueries,
        lastGptQuery: document.lastGptQuery,
        aiAnalysisStatus: document.aiAnalysisStatus
      }
    });

  } catch (error) {
    console.error('Error updating GPT queries count:', error);
    res.status(500).json({ message: 'Server error while updating GPT queries count' });
  }
});

// Get document statistics for a case
router.get('/stats/case/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Verify case exists and user has access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied to this case' });
    }

    const stats = await Document.aggregate([
      { $match: { case: caseDoc._id, status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          byType: {
            $push: '$documentType'
          }
        }
      }
    ]);

    const typeCounts = await Document.aggregate([
      { $match: { case: caseDoc._id, status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: '$documentType',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      totalDocuments: stats[0]?.totalDocuments || 0,
      totalSize: stats[0]?.totalSize || 0,
      typeBreakdown: typeCounts
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching document stats:', error);
    res.status(500).json({ message: 'Server error while fetching document stats' });
  }
});

// Get a single document by ID (must be last to avoid conflicts with other routes)
router.get('/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: 'Invalid document ID format' });
    }

    // Find the document
    const document = await Document.findById(documentId)
      .populate('case', 'caseName caseNumber')
      .populate('uploadedBy', 'firstName lastName');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has access to this document through case ownership
    if (document.case) {
      const caseDoc = await Case.findById(document.case);
      if (!caseDoc || caseDoc.lawyer.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied to this document' });
      }
    } else {
      // If document is not assigned to a case, check if user uploaded it
      if (document.uploadedBy.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied to this document' });
      }
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Server error while fetching document' });
  }
});

module.exports = router;
