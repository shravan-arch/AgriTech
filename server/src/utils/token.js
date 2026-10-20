import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security] JWT_SECRET environment variable must be set in production!');
    }
    console.warn('[Security Warning] JWT_SECRET is not set in environment. Using development fallback key.');
    return 'agritech_mvp_dev_secret_replace_in_env_2026';
  }
  return secret;
};

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (payload) => {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

export default {
  generateToken,
  verifyToken,
};
