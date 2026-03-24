const mongoose = require('mongoose');

const contractClauseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        trim: true,
        description: 'Type of clause (e.g., termination, confidentiality, IP)'
    },
    contractType: {
        type: String,
        required: true,
        description: 'Applicable contract type (e.g., NDA, Employment, Service)'
    },
    jurisdiction: {
        type: String,
        default: 'India',
        description: 'Applicable jurisdiction'
    },
    tags: [{
        type: String,
        trim: true
    }],
    isMandatory: {
        type: Boolean,
        default: false
    },
    tenant_id: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

contractClauseSchema.index({ type: 1, contractType: 1 });
contractClauseSchema.index({ content: 'text', title: 'text' });

const ContractClause = mongoose.model('ContractClause', contractClauseSchema);

module.exports = ContractClause;
