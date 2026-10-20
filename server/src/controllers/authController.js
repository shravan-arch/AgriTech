import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/token.js';
import { getDBStatus } from '../config/db.js';

// In-memory user store for local development when MongoDB Atlas is not yet connected
const mockUsers = new Map();

// Seed a default demo farmer account
const seedDemoFarmer = async () => {
  const hashedPassword = await bcrypt.hash('Farmer123!', 10);
  mockUsers.set('demo@agritech.com', {
    _id: 'mock-farmer-001',
    id: 'mock-farmer-001',
    name: 'Ramesh Patel',
    email: 'demo@agritech.com',
    password: hashedPassword,
    role: 'farmer',
    farmName: 'Surya Organic Farm',
    farmSizeHectares: 25,
    primaryCrops: ['Wheat', 'Mustard', 'Barley'],
    location: { region: 'Punjab', country: 'India' },
    createdAt: new Date().toISOString()
  });
};
seedDemoFarmer();

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, farmName, farmSizeHectares, primaryCrops } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name, email, and password are required fields.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const dbStatus = getDBStatus();

    if (dbStatus.isConnected) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'An account with this email already exists.'
        });
      }

      const user = await User.create({
        name,
        email: normalizedEmail,
        password,
        role: role || 'farmer',
        farmName: farmName || 'My Farm',
        farmSizeHectares: farmSizeHectares || 10,
        primaryCrops: primaryCrops || ['Wheat']
      });

      const token = generateToken({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: user.toJSON(),
        dbMode: 'mongodb'
      });
    } else {
      // In-memory fallback
      if (mockUsers.has(normalizedEmail)) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'An account with this email already exists in dev store.'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const mockId = `mock-user-${Date.now()}`;
      const newUser = {
        _id: mockId,
        id: mockId,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: role || 'farmer',
        farmName: farmName || 'My Farm',
        farmSizeHectares: farmSizeHectares || 10,
        primaryCrops: primaryCrops || ['Wheat'],
        createdAt: new Date().toISOString()
      };

      mockUsers.set(normalizedEmail, newUser);

      const token = generateToken({
        id: mockId,
        email: normalizedEmail,
        name,
        role: newUser.role
      });

      const userResponse = { ...newUser };
      delete userResponse.password;

      return res.status(201).json({
        success: true,
        message: 'User registered successfully (Dev Fallback Mode)',
        token,
        user: userResponse,
        dbMode: 'in-memory-fallback'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Please provide both email and password.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const dbStatus = getDBStatus();

    if (dbStatus.isConnected) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password credentials.'
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password credentials.'
        });
      }

      const token = generateToken({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: user.toJSON(),
        dbMode: 'mongodb'
      });
    } else {
      // In-memory fallback
      const user = mockUsers.get(normalizedEmail);
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password credentials.'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password credentials.'
        });
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      const userResponse = { ...user };
      delete userResponse.password;

      return res.status(200).json({
        success: true,
        message: 'Login successful (Dev Fallback Mode)',
        token,
        user: userResponse,
        dbMode: 'in-memory-fallback'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};

export default {
  register,
  login,
  getMe
};
