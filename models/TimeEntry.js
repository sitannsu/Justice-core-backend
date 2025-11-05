const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  caseName: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  employee: {
    type: String,
    required: true,
    trim: true
  },
  activity: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  hours: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  nonBillable: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  isRunning: {
    type: Boolean,
    default: false
  },
  totalMinutes: {
    type: Number,
    default: 0
  },
  billableAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'billed'],
    default: 'draft'
  },
  tags: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
timeEntrySchema.index({ caseId: 1, date: 1 });
timeEntrySchema.index({ createdBy: 1, date: 1 });
timeEntrySchema.index({ status: 1 });
timeEntrySchema.index({ isRunning: 1 });

// Virtual for formatted duration
timeEntrySchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.totalMinutes / 60);
  const minutes = this.totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
});

// Virtual for total amount
timeEntrySchema.virtual('totalAmount').get(function() {
  if (this.nonBillable) return 0;
  return (this.hours * this.rate) + (this.billableAmount || 0);
});

// Pre-save middleware to calculate hours and amounts
timeEntrySchema.pre('save', function(next) {
  // Calculate total minutes if start and end times are provided
  if (this.startTime && this.endTime) {
    const diffMs = this.endTime.getTime() - this.startTime.getTime();
    this.totalMinutes = Math.round(diffMs / (1000 * 60));
    this.hours = this.totalMinutes / 60;
  }
  
  // Calculate billable amount
  if (!this.nonBillable && this.hours > 0) {
    this.billableAmount = this.hours * this.rate;
  }
  
  next();
});

// Method to start timer
timeEntrySchema.methods.startTimer = function() {
  this.startTime = new Date();
  this.isRunning = true;
  this.status = 'active';
  return this.save();
};

// Method to stop timer
timeEntrySchema.methods.stopTimer = function() {
  this.endTime = new Date();
  this.isRunning = false;
  this.status = 'completed';
  
  // Calculate final hours and amount
  if (this.startTime) {
    const diffMs = this.endTime.getTime() - this.startTime.getTime();
    this.totalMinutes = Math.round(diffMs / (1000 * 60));
    this.hours = this.totalMinutes / 60;
    
    if (!this.nonBillable) {
      this.billableAmount = this.hours * this.rate;
    }
  }
  
  return this.save();
};

// Method to pause timer
timeEntrySchema.methods.pauseTimer = function() {
  this.isRunning = false;
  this.status = 'paused';
  return this.save();
};

// Method to resume timer
timeEntrySchema.methods.resumeTimer = function() {
  this.isRunning = true;
  this.status = 'active';
  return this.save();
};

// Static method to get running timers
timeEntrySchema.statics.getRunningTimers = function(userId) {
  return this.find({ 
    createdBy: userId, 
    isRunning: true,
    status: 'active'
  }).populate('caseId', 'caseName caseNumber');
};

// Static method to get time entry stats
timeEntrySchema.statics.getStats = function(userId, caseId, startDate, endDate) {
  const match = { createdBy: userId };
  
  if (caseId) match.caseId = caseId;
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$hours' },
        billableHours: { 
          $sum: { 
            $cond: [{ $eq: ['$nonBillable', false] }, '$hours', 0] 
          } 
        },
        nonBillableHours: { 
          $sum: { 
            $cond: [{ $eq: ['$nonBillable', true] }, '$hours', 0] 
          } 
        },
        totalAmount: { 
          $sum: { 
            $cond: [{ $eq: ['$nonBillable', false] }, '$billableAmount', 0] 
          } 
        }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
timeEntrySchema.set('toJSON', { virtuals: true });
timeEntrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
