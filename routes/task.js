const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// Get all tasks
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');
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
    progress: req.body.progress,
    dueDate: req.body.dueDate,
    case: req.body.caseId,
    assignedTo: req.body.assignedTo || undefined,
    reminders: req.body.reminders || []
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
    const task = await Task.findById(req.params.id)
      .populate('case', 'number title')
      .populate('assignedTo', 'firstName lastName');
    if (task) {
      res.json(task);
    } else {
      res.status(404).json({ message: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a task
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
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
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
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
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    await task.remove();
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
