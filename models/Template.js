const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String },
  path: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  placeholders: [String],
  previewUrl: { type: String },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);


