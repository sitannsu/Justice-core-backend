const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed', 'Overdue', 'Pending'],
    default: 'Not Started'
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    required: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  dueDate: {
    type: Date,
    required: true
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    required: false
  },
  reminders: [
    {
      recipient: {
        type: String,
        enum: ['me', 'assignee', 'allStaff', 'custom'],
        default: 'me'
      },
      customPerson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person'
      },
      // Absolute reminder time (preferred by UI)
      remindAt: { type: Date },
      when: {
        type: String,
        enum: ['before', 'after'],
        default: 'before'
      },
      offsetAmount: { type: Number, default: 1 },
      offsetUnit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'days'
      },
      notifyBy: {
        type: String,
        enum: ['email', 'app'],
        default: 'email'
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

taskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Task', taskSchema);
