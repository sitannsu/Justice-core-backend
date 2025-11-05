const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  department_type: {
    type: String,
    enum: ['practice_area', 'administrative', 'support'],
    default: 'practice_area'
  },
  parent_department_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  head_of_department_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
departmentSchema.index({ tenant_id: 1, is_active: 1 });
departmentSchema.index({ parent_department_id: 1 });

module.exports = mongoose.model('Department', departmentSchema);
