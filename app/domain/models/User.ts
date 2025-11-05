import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'lawyer' | 'client';
  isActive: boolean;
  lastLogin?: Date;
  firmName?: string;
  numberOfEmployees?: number;
  phoneNumber?: string;
  barNumber?: string;
  practiceAreas?: string[];
  yearsOfExperience?: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
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
    },
    min: [1, 'Number of employees must be at least 1']
  },
  phoneNumber: {
    type: String,
    required: function() {
      return this.role === 'lawyer';
    },
    validate: {
      validator: function(v: string) {
        return /^\+?[1-9]\d{9,14}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  barNumber: {
    type: String,
    sparse: true,
    unique: true
  },
  practiceAreas: [{
    type: String,
    enum: ['Criminal', 'Civil', 'Corporate', 'Family', 'Immigration', 'Real Estate', 'Tax', 'Other']
  }],
  yearsOfExperience: {
    type: Number,
    min: 0
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'lawyer', 'client'],
      message: '{VALUE} is not a valid role'
    },
    default: 'client'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ barNumber: 1 }, { sparse: true });
userSchema.index({ firmName: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

export const User = mongoose.model<IUser>('User', userSchema);
