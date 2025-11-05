const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const clientSchema = new mongoose.Schema({
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: String,
    default: ''
  },
  contactPerson: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String
  },
  address: {
    type: String
  },
  accountType: {
    type: String,
    enum: ['individual', 'business', 'corporate', 'client'],
    default: 'client'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Archived'],
    default: 'Active'
  },
  notes: {
    type: String
  },
  lastContact: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  password: {
    type: String,
    default: 'Password123' // Default password for new clients
  }
});

// Hash password before saving
clientSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Update the updatedAt timestamp before saving
clientSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check password
clientSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Client', clientSchema);
