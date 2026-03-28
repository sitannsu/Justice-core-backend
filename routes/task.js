const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// Get all tasks
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { caseId } = req.query;
    
    const query = { lawyer: userId };
    
    if (caseId && caseId !== 'undefined') {
      query.case = caseId;
    }
    
    console.log(`[TASKS] Fetching tasks for lawyer: ${userId}, query:`, query);
    
    const tasks = await Task.find(query)
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log(`[TASKS] Found ${tasks.length} tasks`);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a task
router.post('/', auth, async (req, res) => {
  const task = new Task({
    title: req.body.title,
    description: req.body.description,
    status: req.body.status,
    priority: req.body.priority,
    progress: req.body.progress || 0,
    dueDate: req.body.dueDate,
    case: req.body.caseId,
    assignedTo: req.body.assignedTo || undefined,
    reminders: req.body.reminders || [],
    lawyer: req.user.userId || req.user.id
  });

  try {
    const newTask = await task.save();
    const populatedTask = await Task.findById(newTask._id)
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');
    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get a specific task
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      lawyer: userId
    })
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');
    
    if (task) {
      res.json(task);
    } else {
      res.status(404).json({ message: 'Task not found or unauthorized' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a task
router.put('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      lawyer: userId
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found or unauthorized' });
    }

    if (req.body.caseId) {
      req.body.case = req.body.caseId;
      delete req.body.caseId;
    }
    Object.assign(task, req.body);
    const updatedTask = await task.save();
    const populatedTask = await Task.findById(updatedTask._id)
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');
    res.json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update task progress
router.patch('/:id/progress', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      lawyer: userId
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found or unauthorized' });
    }

    task.progress = req.body.progress;
    const updatedTask = await task.save();
    const populatedTask = await Task.findById(updatedTask._id)
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');
    res.json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a task
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      lawyer: userId
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found or unauthorized' });
    }
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a comment to a task
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      lawyer: userId
    });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found or unauthorized' });
    }

    const newComment = {
      text: req.body.text,
      author: req.body.author,
      time: new Date()
    };

    task.comments.push(newComment);
    const updatedTask = await task.save();

    // Return just the added comment or the whole populated task based on typical usage
    const populatedTask = await Task.findById(updatedTask._id)
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
