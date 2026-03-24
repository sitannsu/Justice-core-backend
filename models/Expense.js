const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    category: {
        type: String,
        enum: ['travel', 'meals', 'court-fees', 'supplies', 'other'],
        required: true
    },
    case: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    billable: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Reimbursed'],
        default: 'Pending'
    },
    receipt: {
        type: String // URL or path
    },
    notes: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
