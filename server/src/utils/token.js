import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured before issuing or verifying tokens.');
  }
  return process.env.JWT_SECRET;
};

export const generateToken = (payload) => {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
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
