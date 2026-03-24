const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const IPRAsset = require('../models/IPRAsset');
const auth = require('../middleware/auth');

// @route   GET api/ipr
// @desc    Get all IPR assets for user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const assets = await IPRAsset.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(assets);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/ipr/stats
// @desc    Get IPR stats
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Aggregation pipeline to count by type
        const stats = await IPRAsset.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: "$iprType", count: { $sum: 1 } } }
        ]);

        // Format stats
        const formattedStats = {
            total: 0,
            trademarks: 0,
            copyrights: 0,
            patents: 0,
            gis: 0,
            designs: 0
        };

        stats.forEach(item => {
            formattedStats.total += item.count;
            switch (item._id) {
                case 'Trademark': formattedStats.trademarks = item.count; break;
                case 'Copyright': formattedStats.copyrights = item.count; break;
                case 'Patent': formattedStats.patents = item.count; break;
                case 'GI': formattedStats.gis = item.count; break;
                case 'Design': formattedStats.designs = item.count; break;
            }
        });

        res.json(formattedStats);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/ipr
// @desc    Create new IPR asset
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const newAsset = new IPRAsset({
            ...req.body,
            userId: req.user.userId
        });

        const asset = await newAsset.save();
        res.json(asset);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/ipr/:id
// @desc    Update IPR asset
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        let asset = await IPRAsset.findById(req.params.id);

        if (!asset) return res.status(404).json({ msg: 'Asset not found' });
        if (asset.userId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        asset = await IPRAsset.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );

        res.json(asset);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/ipr/:id
// @desc    Delete IPR asset
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const asset = await IPRAsset.findById(req.params.id);

        if (!asset) return res.status(404).json({ msg: 'Asset not found' });
        if (asset.userId.toString() !== req.user.userId) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await IPRAsset.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Asset removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
