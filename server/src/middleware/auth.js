import jwt from 'jsonwebtoken';
import { verifyToken } from '../utils/token.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createProtect = (userStore = defaultUserStore) => async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'A valid bearer token is required.',
    });
  }

  try {
    const decoded = verifyToken(match[1]);
    if (!decoded || typeof decoded.id !== 'string') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token.' });
    }
    const user = await userStore.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'The account for this token no longer exists.',
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token.' });
    }
    return next(error);
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Your account is not permitted to access this resource.',
    });
  }
  return next();
};

export const protect = createProtect();
export default { protect, authorize, createProtect };
