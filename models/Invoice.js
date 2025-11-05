const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date
  },
  expenses: [{
    activity: String,
    description: String,
    costType: {
      type: String,
      enum: ['Hourly', 'Fixed', 'Expense', 'Court Fee', 'Filing Fee', 'Other']
    },
    cost: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    billable: {
      type: Boolean,
      default: true
    },
    paid: {
      type: Boolean,
      default: false
    }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Paid', 'Outstanding', 'Overdue'],
    default: 'Draft'
  },
  notes: String,
  paymentTerms: String
}, {
  timestamps: true
});

// Generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const currentYear = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      invoiceNumber: { $regex: `INV-${currentYear}-` }
    });
    this.invoiceNumber = `INV-${currentYear}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
