const mongoose = require('mongoose');

const contractComplianceRuleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    keywords: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    category: {
        type: String,
        enum: ['termination', 'confidentiality', 'ip', 'payment', 'liability', 'data_privacy', 'other'],
        default: 'other'
    },
    severity: {
        type: String,
        enum: ['warning', 'error'],
        default: 'warning'
    },
    isRequired: {
        type: Boolean,
        default: false,
        description: 'If true, flags missing clauses based on severity'
    },
    contractTypes: [{
        type: String,
        description: 'Types of contracts this rule applies to (e.g., NDA, Employment)'
    }],
    tenant_id: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

contractComplianceRuleSchema.index({ category: 1 });
contractComplianceRuleSchema.index({ contractTypes: 1 });

const ContractComplianceRule = mongoose.model('ContractComplianceRule', contractComplianceRuleSchema);

module.exports = ContractComplianceRule;
