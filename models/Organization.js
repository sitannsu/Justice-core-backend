const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    industry: { type: String, default: 'law-firm' },
    timezone: { type: String, default: 'est' },
    currency: { type: String, default: 'usd' },
    logoUrl: { type: String, default: '' },
    address: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    tenant_id: { type: String, required: true } // Removed unique constraint to avoid index creation issues if duplicates somehow exist, but logic should prevent it.
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
