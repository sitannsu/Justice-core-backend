const mongoose = require('mongoose');

const contractComplianceResultSchema = new mongoose.Schema({
    contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: true
    },
    summary: {
        violations: { type: Number, default: 0 },
        warnings: { type: Number, default: 0 },
        compliant: { type: Number, default: 0 }
    },
    results: [{
        ruleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ContractComplianceRule'
        },
        ruleName: String,
        category: String,
        status: {
            type: String,
            enum: ['compliant', 'warning', 'violation'],
            required: true
        },
        clauseText: {
            type: String,
            description: 'The extracted clause text that was analyzed'
        },
        reasoning: {
            type: String,
            description: 'AI reasoning for this compliance status'
        },
        severity: String
    }]
}, {
    timestamps: true
});

contractComplianceResultSchema.index({ contractId: 1 });

const ContractComplianceResult = mongoose.model('ContractComplianceResult', contractComplianceResultSchema);

module.exports = ContractComplianceResult;
