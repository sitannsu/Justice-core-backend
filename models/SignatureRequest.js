const mongoose = require('mongoose');

const signerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: {
        type: String,
        enum: ['signer', 'approver', 'cc'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'viewed', 'signed', 'approved', 'declined'],
        default: 'pending'
    },
    signedAt: { type: Date },
    signatureData: { type: String }, // Base64 signature image or hash
    ipAddress: { type: String }
});

const signatureRequestSchema = new mongoose.Schema({
    documentName: { type: String, required: true },
    documentType: { type: String, default: 'contract' }, // contract, agreement, notice, nda
    provider: {
        type: String,
        enum: ['manual', 'docusign', 'aadhaar'],
        default: 'manual'
    },
    emailSubject: { type: String },
    emailMessage: { type: String },
    status: {
        type: String,
        enum: ['draft', 'sent', 'in_progress', 'completed', 'cancelled', 'expired'],
        default: 'sent'
    },
    signers: [signerSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    documentUrl: { type: String }, // Link to the original document in S3
    signedDocumentUrl: { type: String }, // Link to the final signed document
    expiresAt: { type: Date },
    remindersEnabled: { type: Boolean, default: true },
    reminderInterval: { type: String, default: '3days' }
}, {
    timestamps: true
});

module.exports = mongoose.model('SignatureRequest', signatureRequestSchema);
