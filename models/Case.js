const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseName: {
    type: String,
    required: true
  },
  caseNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  practiceArea: {
    type: String,
    required: true
  },
  caseStage: {
    type: String,
    required: true
  },
  dateOpened: {
    type: Date,
    required: true
  },
  office: {
    type: String,
    required: false,
    default: ''
  },
  description: {
    type: String,
    required: true
  },
  statuteOfLimitations: Date,
  conflictCheck: {
    type: Boolean,
    default: false
  },
  conflictCheckNotes: String,
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAttorney: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attorney'
  },
  clients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  }],
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  }],
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'pending', 'Active', 'Closed', 'Pending'],
    default: 'active'
  }
}, {
  timestamps: true
});

const Case = mongoose.model('Case', caseSchema);

module.exports = Case;
