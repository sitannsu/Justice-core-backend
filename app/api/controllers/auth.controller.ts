import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../domain/models/User';
import bcrypt from 'bcrypt';

class AuthController {
  async register(req: Request, res: Response) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        firmName,
        numberOfEmployees,
        phoneNumber
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already registered'
        });
      }

      // Map fields and create new user
      const user = await User.create({
        firstName,
        lastName,
        email,
        password, // Password will be hashed by the model pre-save hook
        firmName: req.body.firmName,
        numberOfEmployees: req.body.employees,
        phoneNumber: req.body.phone,
        role: req.body.role || 'lawyer'
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Remove password from response
      const userResponse = user.toObject();
      const { password: _, ...userWithoutPassword } = userResponse;

      res.status(200).json({
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Registration failed'
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email and password are required'
        });
      }

      // Find user
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Remove password from response
      const userResponse = user.toObject();
      const { password: _, ...userWithoutPassword } = userResponse;

      res.json({
        status: 'success',
        data: {
          token,
          user: userWithoutPassword
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Login failed'
      });
    }
  }

  async getCurrentUser(req: Request, res: Response) {
    try {
      // User will be attached by auth middleware
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Not authenticated'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get user'
      });
    }
  }
}

export const authController = new AuthController();
