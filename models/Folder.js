const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, { timestamps: true });

folderSchema.index({ lawyer: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);



