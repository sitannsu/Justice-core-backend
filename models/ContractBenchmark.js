const mongoose = require('mongoose');

const contractBenchmarkSchema = new mongoose.Schema({
    contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: true
    },
    tenant_id: {
        type: String,
        required: false
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
        description: '0-100 similarity score against benchmark corpus'
    },
    marketPosition: {
        type: String,
        enum: ['on_market', 'slightly_off', 'risky'],
        required: true
    },
    comparisonCount: {
        type: Number,
        required: true,
        description: 'Number of similar contracts used for benchmarking'
    },
    clauseComparisons: [{
        category: String,
        targetClause: String,
        similarityScore: Number,
        isAIBased: {
            type: Boolean,
            default: true,
            description: 'True if scored by AI, false if fallen back to Jaccard text similarity'
        },
        deviations: [String],
        recommendation: String
    }]
}, {
    timestamps: true
});

contractBenchmarkSchema.index({ contractId: 1 });
contractBenchmarkSchema.index({ tenant_id: 1 });

const ContractBenchmark = mongoose.model('ContractBenchmark', contractBenchmarkSchema);

module.exports = ContractBenchmark;
