const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const mongoose = require('mongoose');
const OpenAI = require('openai');

// List conversations for current user (lawyer)
router.get('/conversations', auth, async (req, res) => {
  const list = await ChatConversation.find({ participants: req.user.userId })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'firstName lastName email');
  res.json(list);
});

// Create or get a conversation with specific participants
router.post('/conversations', auth, async (req, res) => {
  try {
    const { participantIds = [], title } = req.body;
    const otherIds = (Array.isArray(participantIds) ? participantIds : [])
      .map((id) => new mongoose.Types.ObjectId(id))
      .filter((id) => String(id) !== String(req.user.userId));
    const selfId = new mongoose.Types.ObjectId(req.user.userId);
    const participants = [selfId, ...otherIds];

    // Try to find existing conversation with exactly these participants
    let conv = await ChatConversation.findOne({ participants: { $all: participants } });
    if (!conv || conv.participants.length !== participants.length) {
      conv = await ChatConversation.create({ participants, title });
    }
    // populate both participants
    await conv.populate('participants', 'firstName lastName email');
    res.status(201).json(conv);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get messages
router.get('/conversations/:id/messages', auth, async (req, res) => {
  const conv = await ChatConversation.findById(req.params.id);
  if (!conv || !conv.participants.map(String).includes(req.user.userId)) return res.status(403).json({ message: 'Access denied' });
  const messages = await ChatMessage.find({ conversation: conv._id }).sort({ createdAt: 1 }).populate('sender', 'firstName lastName');
  res.json(messages);
});

// Send message
router.post('/conversations/:id/messages', auth, async (req, res) => {
  const conv = await ChatConversation.findById(req.params.id);
  if (!conv || !conv.participants.map(String).includes(req.user.userId)) return res.status(403).json({ message: 'Access denied' });
  const msg = await ChatMessage.create({ conversation: conv._id, sender: req.user.userId, content: req.body.content });
  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = req.body.content.slice(0, 120);
  await conv.save();
  res.status(201).json(msg);
});

// AI Chat endpoint
router.post('/ai', auth, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create system prompt for legal AI
    const systemPrompt = `You are a legal AI assistant designed to help lawyers and legal professionals. 
    You can provide guidance on legal research, case analysis, document review, and general legal questions. 
    Always provide accurate, helpful information while making it clear that you are an AI assistant and not a substitute for professional legal advice.
    
    Context: ${context ? JSON.stringify(context) : 'General legal assistance'}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    // Create a unique conversation ID for AI chats
    const conversationId = `ai-${Date.now()}`;

    res.json({
      success: true,
      message: aiResponse,
      conversationId: conversationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process AI chat request',
      details: error.message 
    });
  }
});

module.exports = router;


