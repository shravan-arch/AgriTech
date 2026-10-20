import { verifyToken } from '../utils/token.js';
import User from '../models/User.js';
import { getDBStatus } from '../config/db.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied. No token provided.',
    });
  }

  try {
    const decoded = verifyToken(token);
    const dbStatus = getDBStatus();

    if (dbStatus.isConnected) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User belonging to this token no longer exists.',
        });
      }
      req.user = user;
    } else {
      // Offline / fallback mode
      req.user = {
        _id: decoded.id,
        id: decoded.id,
        email: decoded.email,
        name: decoded.name || 'Demo Farmer',
        role: decoded.role || 'farmer',
        farmName: decoded.farmName || 'Green Valley Farm',
      };
    }

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.',
      details: error.message,
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `User role '${req.user?.role}' is not authorized to access this route.`,
      });
    }
    next();
  };
};

export default { protect, authorize };
