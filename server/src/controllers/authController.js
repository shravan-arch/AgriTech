import { generateToken } from '../utils/token.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const registerFields = new Set([
  'name', 'email', 'password', 'farmName', 'farmSizeHectares', 'primaryCrops', 'role',
]);

const invalid = (res, message, fields) => res.status(400).json({
  error: 'Validation Error',
  message,
  ...(fields ? { fields } : {}),
});

const getSafeUser = (user) => {
  const payload = user.toJSON ? user.toJSON() : { ...user };
  delete payload.password;
  return payload;
};

const validateRegistration = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'A JSON object is required.';
  }
  const unknownFields = Object.keys(body).filter((key) => !registerFields.has(key));
  if (unknownFields.length) return `Unsupported fields: ${unknownFields.join(', ')}.`;
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 50) {
    return 'Name must contain 1 to 50 characters.';
  }
  if (typeof body.email !== 'string' || !EMAIL_REGEX.test(body.email.trim())) {
    return 'A valid email address is required.';
  }
  if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) {
    return 'Password must contain 10 to 128 characters.';
  }
  if (body.farmName !== undefined &&
      (typeof body.farmName !== 'string' || body.farmName.trim().length > 100)) {
    return 'Farm name must be a string of at most 100 characters.';
  }
  if (body.farmSizeHectares !== undefined &&
      (!Number.isFinite(Number(body.farmSizeHectares)) || Number(body.farmSizeHectares) <= 0)) {
    return 'Farm size must be a positive number.';
  }
  if (body.primaryCrops !== undefined &&
      (!Array.isArray(body.primaryCrops) ||
        body.primaryCrops.length > 20 ||
        body.primaryCrops.some((crop) => typeof crop !== 'string' || !crop.trim() || crop.length > 60))) {
    return 'Primary crops must be a list of at most 20 non-empty names.';
  }
  return null;
};

export const createAuthController = (userStore) => ({
  register: async (req, res, next) => {
    try {
      const validationMessage = validateRegistration(req.body);
      if (validationMessage) return invalid(res, validationMessage);

      const user = await userStore.create({
        name: req.body.name.trim(),
        email: req.body.email.trim().toLowerCase(),
        password: req.body.password,
        role: 'farmer',
        ...(req.body.farmName ? { farmName: req.body.farmName.trim() } : {}),
        ...(req.body.farmSizeHectares !== undefined
          ? { farmSizeHectares: Number(req.body.farmSizeHectares) }
          : {}),
        ...(req.body.primaryCrops ? { primaryCrops: req.body.primaryCrops.map((crop) => crop.trim()) } : {}),
      });

      const token = generateToken({ id: user._id || user.id });
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: getSafeUser(user),
      });
    } catch (error) {
      return next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) ||
          typeof password !== 'string' || password.length < 1 || password.length > 128) {
        return invalid(res, 'A valid email address and password are required.');
      }

      const user = await userStore.findByEmail(email.trim().toLowerCase());
      if (!user || !(await userStore.verifyPassword(user, password))) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token: generateToken({ id: user._id || user.id }),
        user: getSafeUser(user),
      });
    } catch (error) {
      return next(error);
    }
  },

  getMe: (req, res) => res.status(200).json({
    success: true,
    user: getSafeUser(req.user),
  }),

  getUserById: async (req, res, next) => {
    try {
      const requesterId = req.user._id || req.user.id;
      const user = await userStore.findOwnedById(
        req.params.id,
        requesterId,
        req.user.role === 'admin'
      );
      if (!user) {
        return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
      }
      return res.status(200).json({ success: true, user: getSafeUser(user) });
    } catch (error) {
      return next(error);
    }
  },
});

export default createAuthController;
