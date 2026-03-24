const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    punch_in: Date,
    punch_out: Date,
    total_hours: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late', 'Half-day'],
        default: 'Present'
    },
    location: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    tenant_id: {
        type: String,
        required: true,
        default: 'default'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Attendance', attendanceSchema);
