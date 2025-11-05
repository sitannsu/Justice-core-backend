const mongoose = require('mongoose');

const voiceMemoSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  duration: { type: Number, default: 0 }, // in seconds
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  uploaderRole: { type: String, enum: ['lawyer', 'client', 'sublawyer'], required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['New', 'Reviewed'], default: 'New' },
  transcript: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('VoiceMemo', voiceMemoSchema);


