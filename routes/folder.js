const express = require('express');
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const Document = require('../models/Document');

const router = express.Router();

// List folders for logged-in lawyer with counts
router.get('/', auth, async (req, res) => {
  try {
    const folders = await Folder.find({ lawyer: req.user.userId }).sort({ name: 1 });
    // Aggregate document counts per folder
    const counts = await Document.aggregate([
      { $match: { folder: { $ne: '' } } },
      { $group: { _id: '$folder', count: { $sum: 1 } } }
    ]);
    const countMap = counts.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {});
    const data = folders.map(f => ({ _id: f._id, name: f.name, count: countMap[f.name] || 0, createdAt: f.createdAt }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: 'Server error while listing folders' });
  }
});

// Create folder
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Folder name is required' });
    const folder = await Folder.create({ name: name.trim(), lawyer: req.user.userId });
    res.status(201).json(folder);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Folder already exists' });
    res.status(500).json({ message: 'Server error while creating folder' });
  }
});

// Rename folder (and update documents that reference it)
router.put('/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Folder name is required' });
    const folder = await Folder.findOne({ _id: req.params.id, lawyer: req.user.userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    const oldName = folder.name;
    folder.name = name.trim();
    await folder.save();
    // Update documents that referenced the old name
    await Document.updateMany({ folder: oldName }, { $set: { folder: folder.name } });
    res.json(folder);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Folder name already in use' });
    res.status(500).json({ message: 'Server error while renaming folder' });
  }
});

// Delete folder (keep documents; just clear folder label)
router.delete('/:id', auth, async (req, res) => {
  try {
    const folder = await Folder.findOneAndDelete({ _id: req.params.id, lawyer: req.user.userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    await Document.updateMany({ folder: folder.name }, { $set: { folder: '' } });
    res.json({ message: 'Folder deleted' });
  } catch (e) {
    res.status(500).json({ message: 'Server error while deleting folder' });
  }
});

module.exports = router;


