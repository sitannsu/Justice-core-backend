const mongoose = require('mongoose');

const personSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  peopleGroup: { type: String, default: 'Client' },
  enableClientPortal: { type: Boolean, default: false },
  cellPhone: { type: String },
  workPhone: { type: String },
  homePhone: { type: String },
  address: { type: String },
  lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Person', personSchema);
