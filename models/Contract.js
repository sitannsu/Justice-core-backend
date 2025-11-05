const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  documentType: {
    type: String,
    enum: ['contract', 'agreement', 'terms', 'policy', 'other'],
    default: 'contract'
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: false
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  originalName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'expired', 'terminated', 'archived'],
    default: 'active'
  },
  // Contract-specific fields
  contractValue: {
    type: Number,
    required: false
  },
  startDate: {
    type: Date,
    required: false
  },
  endDate: {
    type: Date,
    required: false
  },
  parties: [{
    name: String,
    type: {
      type: String,
      enum: ['client', 'vendor', 'partner', 'other']
    },
    role: String
  }],
  // AI Analysis fields
  aiAnalysisStatus: {
    type: String,
    enum: ['not_analyzed', 'analyzing', 'analyzed', 'failed'],
    default: 'not_analyzed'
  },
  aiKeyClauses: [{
    type: String,
    title: String,
    description: String,
    risk: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    importance: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    }
  }],
  aiRiskFactors: {
    overallRiskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    riskAssessment: {
      type: Map,
      of: {
        level: String,
        description: String,
        impact: String
      }
    },
    missingClauses: [String],
    complianceIssues: [String],
    recommendations: [String]
  },
  aiComplianceCheck: {
    indianLaws: [{
      law: String,
      compliance: {
        type: String,
        enum: ['compliant', 'non_compliant', 'requires_review']
      },
      details: String
    }],
    internationalStandards: [{
      standard: String,
      compliance: String,
      details: String
    }]
  },
  // Processing metadata
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  ocrText: {
    type: String
  },
  extractedText: {
    type: String
  },
  // Tags and categorization
  tags: [{
    type: String,
    trim: true
  }],
  practiceArea: {
    type: String,
    trim: true
  },
  // Timestamps
  lastAnalyzed: {
    type: Date
  },
  analysisVersion: {
    type: String,
    default: '1.0'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
contractSchema.index({ title: 'text', description: 'text', extractedText: 'text' });
contractSchema.index({ uploadedBy: 1, status: 1 });
contractSchema.index({ case: 1 });
contractSchema.index({ aiAnalysisStatus: 1 });

// Virtual for contract duration
contractSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
});

// Virtual for risk level
contractSchema.virtual('riskLevel').get(function() {
  if (!this.aiRiskFactors?.overallRiskScore) return 'unknown';
  const score = this.aiRiskFactors.overallRiskScore;
  if (score < 30) return 'low';
  if (score < 70) return 'medium';
  return 'high';
});

// Pre-save middleware to update processing status
contractSchema.pre('save', function(next) {
  if (this.aiAnalysisStatus === 'analyzed' && !this.lastAnalyzed) {
    this.lastAnalyzed = new Date();
  }
  next();
});

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;
