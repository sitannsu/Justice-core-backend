const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  title: { type: String },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);


