const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    leave_type: {
        type: String,
        enum: ['Annual', 'Sick', 'Casual', 'Maternity', 'Paternity', 'Unpaid', 'Other'],
        default: 'Annual'
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    total_days: {
        type: Number,
        required: true
    },
    reason: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    applied_date: {
        type: Date,
        default: Date.now
    },
    approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approved_date: Date,
    rejection_reason: String,
    tenant_id: {
        type: String,
        required: true,
        default: 'default'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Leave', leaveSchema);
