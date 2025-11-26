const mongoose = require('mongoose');

const voiceMemoSchema = new mongoose.Schema({
  // File metadata (conditionally required if no transcript present)
  filename: { 
    type: String, 
    required: function () { return !this.transcript; } 
  },
  originalName: { 
    type: String, 
    required: function () { return !this.transcript; } 
  },
  filePath: { 
    type: String, 
    required: function () { return !this.transcript; } 
  },
  fileSize: { 
    type: Number, 
    required: function () { return !this.transcript; } 
  },
  mimeType: { 
    type: String, 
    required: function () { return !this.transcript; } 
  },
  duration: { type: Number, default: 0 }, // in seconds
  // Association to a case is optional for free-form transcripts
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  uploaderRole: { type: String, enum: ['lawyer', 'client', 'sublawyer'], required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['New', 'Reviewed'], default: 'New' },
  // If present, memo can be text-only without audio file
  transcript: { type: String },
  // Sharing controls
  sharedWithClients: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('VoiceMemo', voiceMemoSchema);


