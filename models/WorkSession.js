const mongoose = require('mongoose');

const workSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tenant_id: { type: String },
  session_start: { type: Date, default: Date.now },
  session_end: { type: Date },
  total_hours: { type: Number }, // computed at end
  session_type: { 
    type: String, 
    enum: ['office', 'remote', 'court', 'client_meeting'],
    default: 'office'
  },
  location: { type: String },
  notes: { type: String },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WorkSession', workSessionSchema);


