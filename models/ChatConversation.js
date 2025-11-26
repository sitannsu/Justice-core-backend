const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  title: { type: String },
  description: { type: String },
  type: { type: String, enum: ['team', 'department', 'project'], default: 'team' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);

