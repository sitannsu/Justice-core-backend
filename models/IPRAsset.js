const mongoose = require('mongoose');

const iprAssetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    iprType: {
        type: String,
        enum: ['Trademark', 'Copyright', 'Patent', 'GI', 'Design'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Registered', 'Objected', 'Refused', 'Opposed', 'Withdrawn', 'Abandoned'],
        default: 'Pending'
    },
    applicationNumber: {
        type: String,
        required: true
    },
    registrationNumber: {
        type: String
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    // Classification
    classNumbers: [String], // Array of strings e.g., ["9", "35", "42"]
    goodsServices: String,

    // Jurisdiction
    jurisdiction: String, // e.g., "India"
    office: String, // e.g., "IPO Delhi", "TMR Mumbai"

    // Dates
    applicationDate: Date,
    registrationDate: Date,
    expiryDate: Date,
    nextRenewalDate: Date,
    lastActionDate: Date,
    nextHearingDate: Date,
    priorityDate: Date,
    publicationDate: Date,
    journalNumber: String,

    // Parties
    proprietor: {
        name: String,
        address: String,
        nationality: String
    },
    agent: {
        name: String,
        code: String,
        address: String,
        email: String,
        phone: String
    },

    // Metadata
    tags: [String],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Add index for faster searching
iprAssetSchema.index({ userId: 1, iprType: 1 });
iprAssetSchema.index({ applicationNumber: 1 });

module.exports = mongoose.model('IPRAsset', iprAssetSchema);
