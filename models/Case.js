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
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  status: {
    type: String,
    enum: [
      'Active', 'active', 'Closed', 'closed', 'Pending', 'pending', 
      'Intake', 'intake', 'Consultation', 'consultation', 
      'Filed', 'filed', 'Filing', 'filing', 
      'Hearing', 'hearing', 'Resolution', 'resolution'
    ],
    default: 'Active'
  }
}, {
  timestamps: true
});

const Case = mongoose.model('Case', caseSchema);

module.exports = Case;
