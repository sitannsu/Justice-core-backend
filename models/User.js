const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  firstName: { 
    type: String, 
    required: true 
  },
  lastName: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['admin', 'lawyer', 'client'], 
    default: 'client' 
  },
  firmName: { 
    type: String, 
    required: function() { 
      return this.role === 'lawyer'; 
    } 
  },
  numberOfEmployees: { 
    type: Number, 
    required: function() { 
      return this.role === 'lawyer'; 
    } 
  },
  phoneNumber: { 
    type: String, 
    required: function() { 
      return this.role === 'lawyer'; 
    } 
  },
  zipCode: {
    type: String,
    default: ''
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  googleCalendarTokens: {
    type: Object,
    default: null
  },
  lastLogin: Date,
  tenant_id: {
    type: String,
    default: 'default'
  }
}, { 
  timestamps: true 
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
