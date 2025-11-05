const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  description: {
    type: String,
    trim: true
  },
  base_hourly_rate: {
    type: Number,
    min: 0,
    default: 0
  },
  is_billable: {
    type: Boolean,
    default: true
  },
  permissions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tenant_id: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
positionSchema.index({ tenant_id: 1, is_active: 1 });
positionSchema.index({ level: 1 });

module.exports = mongoose.model('Position', positionSchema);
