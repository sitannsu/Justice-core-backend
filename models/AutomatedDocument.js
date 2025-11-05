const mongoose = require('mongoose');

const clauseSchema = new mongoose.Schema({
  title: String,
  text: String,
  risk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
}, { _id: false });

const referenceSchema = new mongoose.Schema({
  type: { type: String, enum: ['BareAct', 'CaseLaw'], required: true },
  citation: String,
  link: String
}, { _id: false });

const automatedDocumentSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  docType: { type: String, default: 'General' },
  language: { type: String, default: 'en' },
  ocrText: { type: String, default: '' },
  clauses: [clauseSchema],
  references: [referenceSchema],
  tags: [String]
}, { timestamps: true });

module.exports = mongoose.model('AutomatedDocument', automatedDocumentSchema);


