const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  filePath: {
    type: String,
    required: true
  },
  s3Bucket: {
    type: String,
    required: false
  },
  s3Key: {
    type: String,
    required: false
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: false // Made optional to support two-step upload process
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentType: {
    type: String,
    enum: ['pleading', 'motion', 'brief', 'evidence', 'correspondence', 'contract', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['temp', 'active', 'archived', 'deleted'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  },
  folder: {
    type: String,
    trim: true,
    default: ''
  },
  // AI Integration fields
  gptQueries: {
    type: Number,
    default: 0
  },
  lastGptQuery: {
    type: Date
  },
  aiAnalysisStatus: {
    type: String,
    enum: ['not_analyzed', 'analyzing', 'analyzed', 'failed'],
    default: 'not_analyzed'
  },
  // File categorization
  fileCategory: {
    type: String,
    enum: ['document', 'image', 'video', 'audio', 'archive', 'other'],
    default: 'document'
  },
  // Additional metadata
  language: {
    type: String,
    default: 'en'
  },
  isConfidential: {
    type: Boolean,
    default: false
  },
  retentionPolicy: {
    type: String,
    enum: ['permanent', '7_years', '3_years', '1_year', '90_days'],
    default: '7_years'
  },
  // File processing status
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'completed'
  },
  // OCR and text extraction
  hasOcrText: {
    type: Boolean,
    default: false
  },
  ocrText: {
    type: String
  },
  // Version control
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    fileId: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
documentSchema.index({ case: 1, status: 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ documentType: 1 });

// Virtual for file extension
documentSchema.virtual('fileExtension').get(function() {
  return this.originalName.split('.').pop().toLowerCase();
});

// Virtual for formatted file size
documentSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for formatted upload date
documentSchema.virtual('formattedUploadDate').get(function() {
  return this.createdAt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
});

// Virtual for file type icon
documentSchema.virtual('fileTypeIcon').get(function() {
  const ext = this.fileExtension;
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return '🎥';
  if (['mp3', 'wav', 'aac'].includes(ext)) return '🎵';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📄';
});

// Virtual for AI analysis status
documentSchema.virtual('aiAnalysisText').get(function() {
  if (this.gptQueries > 0) {
    return `This document has been analyzed with AI-powered questions and answers`;
  }
  return 'This document has not been analyzed with AI yet';
});

// Pre-save middleware to validate required fields when status is 'active'
documentSchema.pre('save', function(next) {
  if (this.status === 'active' && !this.case) {
    return next(new Error('Case is required when document status is active'));
  }
  next();
});

// Ensure virtual fields are serialized
documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Document', documentSchema);
