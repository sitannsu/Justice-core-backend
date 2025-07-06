const mongoose = require('mongoose');

const intervalSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    default: 5
  },
  interval: {
    type: Number,
    required: true,
    default: 15,
    min: 1,
    max: 1440 // 24 hours in minutes
  },
  unit: {
    type: String,
    enum: ['seconds', 'minutes', 'hours', 'days'],
    default: 'minutes'
  }
}, {
  timestamps: true
});

const Interval = mongoose.model('Interval', intervalSchema);

module.exports = Interval; 