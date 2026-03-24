const mongoose = require('mongoose');

const contractAIFindingSchema = new mongoose.Schema({
    contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: true
    },
    clauseText: {
        type: String,
        required: true
    },
    riskScore: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        description: 'Risk score from 1-5'
    },
    riskType: {
        type: String,
        enum: ['legal_risk', 'ambiguity', 'missing_protection', 'compliance', 'unfavorable_terms', 'none'],
        required: true
    },
    suggestion: {
        type: String,
        description: 'Suggested replacement for risk >= 3'
    },
    explanation: {
        type: String,
        description: 'Reason for the risk assessment'
    },
    actionTaken: {
        type: Boolean,
        default: false,
        description: 'Whether the suggestion was applied'
    }
}, {
    timestamps: true
});

contractAIFindingSchema.index({ contractId: 1 });
contractAIFindingSchema.index({ riskType: 1, riskScore: -1 });

const ContractAIFinding = mongoose.model('ContractAIFinding', contractAIFindingSchema);

module.exports = ContractAIFinding;
