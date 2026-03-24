const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    referenceNumber: {
        type: String,
        unique: true
    },
    type: {
        type: String,
        enum: ['Legal Notice', 'Show Cause', 'Demand Notice', 'Court Summons', 'Other'],
        default: 'Legal Notice'
    },
    case: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case'
    },
    recipient: {
        name: String,
        address: String,
        email: String,
        phone: String
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dateSent: {
        type: Date,
        default: Date.now
    },
    dueDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Delivered', 'Responded', 'Overdue', 'Closed'],
        default: 'Draft'
    },
    priority: {
        type: String,
        enum: ['High', 'Medium', 'Low'],
        default: 'Medium'
    },
    content: String,
    attachments: [String], // URLs
    notes: String
}, {
    timestamps: true
});

// Generate reference number
noticeSchema.pre('save', async function (next) {
    if (!this.referenceNumber) {
        const currentYear = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            referenceNumber: { $regex: `NOT-${currentYear}-` }
        });
        this.referenceNumber = `NOT-${currentYear}-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Notice', noticeSchema);
