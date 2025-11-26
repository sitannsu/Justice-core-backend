const mongoose = require('mongoose');

const caseAssignmentSchema = new mongoose.Schema({
  matter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignment_type: { 
    type: String, 
    enum: ['lead_lawyer', 'associate', 'paralegal', 'consultant', 'observer'], 
    default: 'associate' 
  },
  hourly_rate: { type: Number },
  notes: { type: String },
  assignment_date: { type: Date, default: Date.now },
  completion_date: { type: Date },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CaseAssignment', caseAssignmentSchema);


