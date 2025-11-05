const mongoose = require('mongoose');

const documentRunSchema = new mongoose.Schema({
  automation: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentAutomation', required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  outputPath: { type: String },
  outputMime: { type: String, default: 'text/html' },
  error: { type: String },
  payload: { type: mongoose.Schema.Types.Mixed },
  recipients: [String],
}, { timestamps: true });

module.exports = mongoose.model('DocumentRun', documentRunSchema);


