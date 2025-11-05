const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
  },
  coordinates: {
    type: {
      latitude: Number,
      longitude: Number
    },
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('location', LocationSchema);
