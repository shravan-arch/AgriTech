import { userStore } from '../storage/userStore.js';
import { generateToken } from '../utils/token.js';
import { getDBStatus } from '../config/db.js';

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, farmName, farmSizeHectares, primaryCrops } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'A valid name is required.'
      });
    }

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'A valid email address is required.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const exists = await userStore.emailExists(normalizedEmail);
    if (exists) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.'
      });
    }

    // Security: Enforce default role 'farmer' to prevent privilege escalation via registration
    const user = await userStore.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'farmer',
      farmName: (farmName && typeof farmName === 'string') ? farmName.trim() : 'My Farm',
      farmSizeHectares: Number(farmSizeHectares) || 10,
      primaryCrops: Array.isArray(primaryCrops) ? primaryCrops : ['Wheat']
    });

    const token = generateToken({
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    const userPayload = user.toJSON ? user.toJSON() : { ...user };
    delete userPayload.password;

    const dbStatus = getDBStatus();

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userPayload,
      storageMode: dbStatus.isConnected ? 'mongodb-atlas' : 'local-persistent-store'
    });
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
        message: 'Both email and password are required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await userStore.findByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password credentials.'
      });
    }

    const isMatch = await userStore.verifyPassword(user, password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password credentials.'
      });
    }

    const token = generateToken({
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    const userPayload = user.toJSON ? user.toJSON() : { ...user };
    delete userPayload.password;

    const dbStatus = getDBStatus();

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userPayload,
      storageMode: dbStatus.isConnected ? 'mongodb-atlas' : 'local-persistent-store'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  const userPayload = req.user.toJSON ? req.user.toJSON() : { ...req.user };
  delete userPayload.password;

  res.status(200).json({
    success: true,
    user: userPayload
  });
};

// @desc    Get user by ID (Protected by Ownership or Admin)
// @route   GET /api/auth/user/:id
// @access  Private (Owner or Admin)
export const getUserById = async (req, res) => {
  const user = await userStore.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found' });
  }

  const userPayload = user.toJSON ? user.toJSON() : { ...user };
  delete userPayload.password;

  res.status(200).json({
    success: true,
    user: userPayload
  });
};

export default {
  register,
  login,
  getMe,
  getUserById
};
