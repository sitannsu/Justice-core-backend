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
    required: true
  },
  description: String,
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
  clients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
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
    type: Map,
    of: String
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'pending'],
    default: 'active'
  }
}, {
  timestamps: true
});

const Case = mongoose.model('Case', caseSchema);

module.exports = Case;
