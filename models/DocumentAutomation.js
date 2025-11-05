const mongoose = require('mongoose');

const mappingSchema = new mongoose.Schema({
  placeholder: { type: String, required: true },
  field: { type: String, required: true }, // e.g., case.caseNumber, client.company
  staticValue: { type: String },
}, { _id: false });

const documentAutomationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  trigger: { type: String, enum: ['on_case_creation', 'on_status_change', 'scheduled', 'manual'], default: 'manual' },
  triggerDetails: { type: mongoose.Schema.Types.Mixed },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  templatePath: { type: String },
  templatePlaceholders: [String],
  mappings: [mappingSchema],
  recipients: [String],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('DocumentAutomation', documentAutomationSchema);


