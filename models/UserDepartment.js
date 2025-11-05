const mongoose = require('mongoose');

const userDepartmentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  position_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    required: true
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date
  },
  tenant_id: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
userDepartmentSchema.index({ user_id: 1, is_active: 1 });
userDepartmentSchema.index({ department_id: 1, is_active: 1 });
userDepartmentSchema.index({ tenant_id: 1 });

module.exports = mongoose.model('UserDepartment', userDepartmentSchema);
