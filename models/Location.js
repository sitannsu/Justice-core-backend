const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: Number,
    default: 5
  }
}, {
  timestamps: true
});

const Location = mongoose.model('Location', locationSchema);

module.exports = Location; 