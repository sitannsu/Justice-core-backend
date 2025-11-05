const mongoose = require('mongoose');

const attorneySchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  barNumber: {
    type: String,
    trim: true
  },
  practiceAreas: [{
    type: String,
    trim: true
  }],
  specialization: {
    type: String,
    trim: true
  },
  hourlyRate: {
    type: Number,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  experience: {
    type: String,
    enum: ['junior', 'mid-level', 'senior', 'partner'],
    default: 'mid-level'
  },
  bio: {
    type: String,
    trim: true
  },
  avatar: {
    type: String
  },
  assignedCases: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  }],
  totalCases: {
    type: Number,
    default: 0
  },
  activeCases: {
    type: Number,
    default: 0
  },
  completedCases: {
    type: Number,
    default: 0
  },
  totalHours: {
    type: Number,
    default: 0
  },
  totalBilled: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
attorneySchema.index({ email: 1 });
attorneySchema.index({ firm: 1 });
attorneySchema.index({ status: 1 });
attorneySchema.index({ practiceAreas: 1 });
attorneySchema.index({ assignedCases: 1 });

// Virtual for full name
attorneySchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for initials
attorneySchema.virtual('initials').get(function() {
  return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
});

// Virtual for case load percentage
attorneySchema.virtual('caseLoadPercentage').get(function() {
  if (this.totalCases === 0) return 0;
  return Math.round((this.activeCases / this.totalCases) * 100);
});

// Pre-save middleware to update case counts
attorneySchema.pre('save', function(next) {
  if (this.isModified('assignedCases')) {
    this.totalCases = this.assignedCases.length;
    // You can add logic here to calculate active vs completed cases
  }
  next();
});

// Method to assign a case
attorneySchema.methods.assignCase = function(caseId) {
  if (!this.assignedCases.includes(caseId)) {
    this.assignedCases.push(caseId);
    this.totalCases = this.assignedCases.length;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unassign a case
attorneySchema.methods.unassignCase = function(caseId) {
  this.assignedCases = this.assignedCases.filter(id => id.toString() !== caseId.toString());
  this.totalCases = this.assignedCases.length;
  return this.save();
};

// Method to get attorney workload
attorneySchema.methods.getWorkload = function() {
  return {
    totalCases: this.totalCases,
    activeCases: this.activeCases,
    completedCases: this.completedCases,
    caseLoadPercentage: this.caseLoadPercentage,
    totalHours: this.totalHours,
    totalBilled: this.totalBilled
  };
};

// Static method to find attorneys by practice area
attorneySchema.statics.findByPracticeArea = function(practiceArea) {
  return this.find({
    practiceAreas: { $in: [practiceArea] },
    status: 'active'
  });
};

// Static method to find available attorneys (not overloaded)
attorneySchema.statics.findAvailable = function(maxCases = 10) {
  return this.find({
    status: 'active',
    totalCases: { $lt: maxCases }
  });
};

// Ensure virtual fields are serialized
attorneySchema.set('toJSON', { virtuals: true });
attorneySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Attorney', attorneySchema);
