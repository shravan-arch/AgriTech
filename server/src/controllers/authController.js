import crypto from 'crypto';
import { generateToken } from '../utils/token.js';
import defaultGoogleAuthService from '../services/googleAuthService.js';
import defaultEmailService from '../services/emailService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const registerFields = new Set([
  'name', 'email', 'password', 'farmName', 'farmSizeHectares', 'primaryCrops', 'role', 'selectedRole', 'requestedRole', 'language',
]);

const invalid = (res, message, fields) => res.status(400).json({
  error: 'Validation Error',
  message,
  ...(fields ? { fields } : {}),
});

const getSafeUser = (user) => {
  const payload = user.toJSON ? user.toJSON() : { ...user };
  payload.hasPassword = Boolean(user.password);
  delete payload.password;
  delete payload.resetPasswordToken;
  delete payload.resetPasswordExpires;
  delete payload.emailVerificationToken;
  delete payload.emailVerificationExpires;
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
  const selectedRole = body.selectedRole || body.role || body.requestedRole;
  if (selectedRole !== undefined && !['user', 'farmer', 'admin'].includes(selectedRole)) {
    return 'Role must be either User or Admin.';
  }
  const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'];
  if (body.language !== undefined && !SUPPORTED_LANGUAGES.includes(body.language)) {
    return 'Language must be one of: ' + SUPPORTED_LANGUAGES.join(', ') + '.';
  }
  return null;
};

const getClientIp = (req) => {
  let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  if (typeof ip === 'string') {
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    if (ip === '::1') {
      ip = '127.0.0.1';
    }
  }
  return ip;
};

export const createRateLimiter = ({
  windowMs = process.env.RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
    : 15 * 60 * 1000,
  maxPerEmail = process.env.RATE_LIMIT_EMAIL_MAX
    ? parseInt(process.env.RATE_LIMIT_EMAIL_MAX, 10)
    : process.env.NODE_ENV === 'test'
      ? 100
      : 5,
  maxPerIp = process.env.RATE_LIMIT_IP_MAX
    ? parseInt(process.env.RATE_LIMIT_IP_MAX, 10)
    : process.env.NODE_ENV === 'test'
      ? 100
      : process.env.NODE_ENV === 'development'
        ? 60
        : 30,
} = {}) => {
  const hits = new Map();

  const cleanup = (now) => {
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((ts) => now - ts < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else if (valid.length !== timestamps.length) {
        hits.set(key, valid);
      }
    }
  };

  const check = (key, maxLimit, now) => {
    const timestamps = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (timestamps.length >= maxLimit) {
      const oldest = timestamps[0];
      const resetTime = oldest + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
      return { allowed: false, retryAfterSeconds, resetTime };
    }
    return { allowed: true, timestamps };
  };

  const record = (key, checkResult, now) => {
    hits.set(key, [...checkResult.timestamps, now]);
  };

  const limiter = (ip, email, customNow) => {
    const now = typeof customNow === 'number' ? customNow : Date.now();
    cleanup(now);

    const ipKey = `ip:${ip || 'unknown'}`;
    const emailKey = email ? `email:${email.toLowerCase().trim()}` : null;

    // 1. Check IP limit
    const ipCheck = check(ipKey, maxPerIp, now);
    if (!ipCheck.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: ipCheck.retryAfterSeconds,
        reason: 'ip',
        message: `Too many password reset requests from this network. Please try again in ${Math.ceil(ipCheck.retryAfterSeconds / 60)} minute(s).`,
      };
    }

    // 2. Check Email limit if provided
    if (emailKey) {
      const emailCheck = check(emailKey, maxPerEmail, now);
      if (!emailCheck.allowed) {
        return {
          allowed: false,
          retryAfterSeconds: emailCheck.retryAfterSeconds,
          reason: 'email',
          message: `Too many password reset requests for this account. Please try again in ${Math.ceil(emailCheck.retryAfterSeconds / 60)} minute(s).`,
        };
      }
      record(ipKey, ipCheck, now);
      record(emailKey, emailCheck, now);
    } else {
      record(ipKey, ipCheck, now);
    }

    return { allowed: true };
  };

  limiter.reset = () => hits.clear();
  return limiter;
};

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!domain) return email;
  const visible = local.length <= 2 ? `${local[0]}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}@${domain}`;
};

export const createAuthController = (
  userStore,
  {
    googleAuthService = defaultGoogleAuthService,
    emailService = defaultEmailService,
    rateLimiter,
    verificationRateLimiter: customVerificationRateLimiter,
    requireEmailVerification,
  } = {}
) => {
  const shouldRequireEmailVerification =
    requireEmailVerification !== undefined
      ? Boolean(requireEmailVerification)
      : process.env.REQUIRE_EMAIL_VERIFICATION === 'true' ||
        (process.env.REQUIRE_EMAIL_VERIFICATION !== 'false' &&
          process.env.STORAGE_MODE !== 'local-json' &&
          process.env.NODE_ENV !== 'test' &&
          Boolean(process.env.SMTP_HOST));

  const resetRateLimiter =
    rateLimiter ||
    createRateLimiter({
      windowMs: process.env.RATE_LIMIT_WINDOW_MS
        ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
        : 15 * 60 * 1000,
      maxPerEmail: process.env.RATE_LIMIT_EMAIL_MAX
        ? parseInt(process.env.RATE_LIMIT_EMAIL_MAX, 10)
        : process.env.NODE_ENV === 'test'
          ? 100
          : 5,
      maxPerIp: process.env.RATE_LIMIT_IP_MAX
        ? parseInt(process.env.RATE_LIMIT_IP_MAX, 10)
        : process.env.NODE_ENV === 'test'
          ? 100
          : process.env.NODE_ENV === 'development'
            ? 60
            : 30,
    });

  const verificationRateLimiter =
    customVerificationRateLimiter ||
    createRateLimiter({
      windowMs: process.env.RATE_LIMIT_WINDOW_MS
        ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
        : 15 * 60 * 1000,
      maxPerEmail: process.env.RATE_LIMIT_EMAIL_MAX
        ? parseInt(process.env.RATE_LIMIT_EMAIL_MAX, 10)
        : process.env.NODE_ENV === 'test'
          ? 100
          : 3,
      maxPerIp: process.env.RATE_LIMIT_IP_MAX
        ? parseInt(process.env.RATE_LIMIT_IP_MAX, 10)
        : process.env.NODE_ENV === 'test'
          ? 100
          : process.env.NODE_ENV === 'development'
            ? 60
            : 30,
    });

  return {
    register: async (req, res, next) => {
      try {
        const validationMessage = validateRegistration(req.body);
        if (validationMessage) return invalid(res, validationMessage);

        const normalizedEmail = req.body.email.trim().toLowerCase();
        const existingUser = await userStore.findByEmail(normalizedEmail, { includeSecrets: true });

        if (existingUser) {
          if (existingUser.emailVerified === true) {
            return res.status(409).json({
              error: 'Conflict',
              message: 'An account with that email already exists.',
            });
          }

          // Existing unverified account retry flow: regenerate token and resend
          if (shouldRequireEmailVerification) {
            const ip = getClientIp(req);
            const rateLimitResult = verificationRateLimiter(ip, normalizedEmail);
            const isAllowed =
              typeof rateLimitResult === 'boolean'
                ? rateLimitResult
                : rateLimitResult?.allowed !== false;

            if (!isAllowed) {
              const retryAfter = rateLimitResult?.retryAfterSeconds || 900;
              res.set('Retry-After', String(retryAfter));
              return res.status(429).json({
                error: 'Too Many Requests',
                message: rateLimitResult?.message || 'Too many verification requests. Please try again later.',
                retryAfter,
              });
            }

            const rawToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            if (typeof userStore.updateUnverifiedUser === 'function') {
              await userStore.updateUnverifiedUser(existingUser._id || existingUser.id, {
                name: req.body.name.trim(),
                password: req.body.password,
                farmName: req.body.farmName ? req.body.farmName.trim() : undefined,
                farmSizeHectares: req.body.farmSizeHectares !== undefined ? Number(req.body.farmSizeHectares) : undefined,
                primaryCrops: req.body.primaryCrops ? req.body.primaryCrops.map((c) => c.trim()) : undefined,
                emailVerificationToken: hashedToken,
                emailVerificationExpires: expiresAt,
              });
            } else {
              await userStore.setEmailVerificationToken(existingUser._id || existingUser.id, hashedToken, expiresAt);
            }

            try {
              await emailService.sendVerificationEmail({
                to: existingUser.email,
                name: req.body.name.trim(),
                verificationToken: rawToken,
              });
            } catch (deliveryError) {
              return res.status(503).json({
                error: 'Service Unavailable',
                message: 'Failed to deliver verification email. Please try again later or request a new verification link.',
              });
            }

            return res.status(201).json({
              success: true,
              requiresEmailVerification: true,
              message: 'Verification email resent. Please check your inbox to verify your account.',
              user: getSafeUser(existingUser),
            });
          }

          return res.status(409).json({
            error: 'Conflict',
            message: 'An account with that email already exists.',
          });
        }

        const requestedRoleCandidate = req.body.selectedRole || req.body.role || req.body.requestedRole;
        const requestedAdmin = requestedRoleCandidate === 'admin';
        const roleRequest = requestedAdmin
          ? {
              requestedRole: 'admin',
              status: 'pending',
              requestedAt: new Date(),
            }
          : {
              status: 'none',
            };
        const userLanguage = req.body.language === 'hi' ? 'hi' : 'en';

        if (shouldRequireEmailVerification) {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

          const user = await userStore.create({
            name: req.body.name.trim(),
            email: normalizedEmail,
            password: req.body.password,
            role: 'farmer',
            status: 'active',
            roleRequest,
            language: userLanguage,
            emailVerified: false,
            emailVerificationToken: hashedToken,
            emailVerificationExpires: expiresAt,
            ...(req.body.farmName ? { farmName: req.body.farmName.trim() } : {}),
            ...(req.body.farmSizeHectares !== undefined
              ? { farmSizeHectares: Number(req.body.farmSizeHectares) }
              : {}),
            ...(req.body.primaryCrops ? { primaryCrops: req.body.primaryCrops.map((crop) => crop.trim()) } : {}),
          });

          try {
            await emailService.sendVerificationEmail({
              to: user.email,
              name: user.name,
              verificationToken: rawToken,
            });
          } catch (deliveryError) {
            return res.status(503).json({
              error: 'Service Unavailable',
              message: 'Account created, but failed to deliver verification email. Please try again later or request a new verification link.',
            });
          }

          return res.status(201).json({
            success: true,
            requiresEmailVerification: true,
            requiresAdminApproval: requestedAdmin,
            message: requestedAdmin
              ? 'User registered successfully. Your request for an Admin account has been submitted and is pending administrator approval. Please check your email to verify your address.'
              : 'User registered successfully. Please check your email and verify your address before logging in.',
            user: getSafeUser(user),
          });
        }

        const user = await userStore.create({
          name: req.body.name.trim(),
          email: normalizedEmail,
          password: req.body.password,
          role: 'farmer',
          status: 'active',
          roleRequest,
          language: userLanguage,
          ...(req.body.farmName ? { farmName: req.body.farmName.trim() } : {}),
          ...(req.body.farmSizeHectares !== undefined
            ? { farmSizeHectares: Number(req.body.farmSizeHectares) }
            : {}),
          ...(req.body.primaryCrops ? { primaryCrops: req.body.primaryCrops.map((crop) => crop.trim()) } : {}),
        });

        const token = generateToken({ id: user._id || user.id, tokenVersion: user.tokenVersion || 0 });
        return res.status(201).json({
          success: true,
          requiresAdminApproval: requestedAdmin,
          message: requestedAdmin
            ? 'User registered successfully. Your request for an Admin account has been submitted and is pending administrator approval.'
            : 'User registered successfully',
          token,
          user: getSafeUser(user),
        });
      } catch (error) {
        return next(error);
      }
    },

    login: async (req, res, next) => {
      try {
        const { email, password, portal } = req.body || {};
        if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) ||
            typeof password !== 'string' || password.length < 1 || password.length > 128) {
          return invalid(res, 'A valid email address and password are required.');
        }

        const user = await userStore.findByEmail(email.trim().toLowerCase());
        if (!user || !(await userStore.verifyPassword(user, password))) {
          try {
            if (typeof userStore.createAuditLog === 'function') {
              await userStore.createAuditLog({
                action: 'AUTH_FAILURE',
                targetUserEmail: email.trim().toLowerCase(),
                targetUserId: user ? (user._id || user.id) : null,
                targetUserName: user ? user.name : 'Unknown User',
                reason: 'Failed login attempt: invalid credentials',
                ipAddress: getClientIp(req),
              });
            }
          } catch {
            // Non-blocking security audit logging
          }
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid email or password.',
          });
        }

        if (user.status === 'suspended') {
          try {
            if (typeof userStore.createAuditLog === 'function') {
              await userStore.createAuditLog({
                action: 'AUTH_FAILURE',
                targetUserEmail: user.email,
                targetUserId: user._id || user.id,
                targetUserName: user.name,
                reason: 'Failed login attempt: account is suspended',
                ipAddress: getClientIp(req),
              });
            }
          } catch {
            // Non-blocking security audit logging
          }
          return res.status(403).json({
            error: 'Forbidden',
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended. Please contact system administration.',
          });
        }

        if (shouldRequireEmailVerification && user.emailVerified === false) {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          });
        }

        const requestedPortal = portal ? String(portal).toLowerCase().trim() : null;
        if (requestedPortal === 'admin') {
          if (user.roleRequest?.status === 'pending') {
            return res.status(403).json({
              error: 'Forbidden',
              code: 'ADMIN_PENDING_APPROVAL',
              message: 'Your administrator account application is pending review by an authorized administrator.',
            });
          }
          if (user.role !== 'admin') {
            return res.status(403).json({
              error: 'Forbidden',
              code: 'NOT_AN_ADMIN',
              message: 'Access Denied: This account does not possess Administrative privileges.',
            });
          }
        } else if (requestedPortal === 'user' || requestedPortal === 'farmer') {
          if (user.role === 'admin') {
            return res.status(403).json({
              error: 'Forbidden',
              code: 'ADMIN_PORTAL_REQUIRED',
              message: 'Administrator accounts must log in using the Admin Login option.',
            });
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Login successful',
          token: generateToken({ id: user._id || user.id, tokenVersion: user.tokenVersion || 0 }),
          user: getSafeUser(user),
        });
      } catch (error) {
        return next(error);
      }
    },

    googleAuth: async (req, res, next) => {
      try {
        const { credential, idToken, portal } = req.body || {};
        const tokenToVerify = credential || idToken;
        if (!tokenToVerify || typeof tokenToVerify !== 'string') {
          return invalid(res, 'Google identity token is required.');
        }

        const payload = await googleAuthService.verifyGoogleIdToken(tokenToVerify);

        if (!payload.email_verified || !payload.email) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Google account email is not verified.',
          });
        }

        // 1. Check if user already exists by verified googleId
        let user = await userStore.findByGoogleId(payload.sub);

        if (!user) {
          // 2. Check if an account already exists with this verified email
          const existingUser = await userStore.findByEmail(payload.email);
          if (existingUser) {
            // Safe provider linking: email is verified by Google, attach googleId
            const userId = existingUser._id || existingUser.id;
            user = await userStore.linkGoogleAccount(userId, payload.sub);
            if (!user) user = existingUser;
          } else {
            // 3. Create a new user with strictly default role 'farmer'
            user = await userStore.create({
              name: (payload.name && payload.name.trim()) || payload.email.split('@')[0],
              email: payload.email,
              googleId: payload.sub,
              role: 'farmer',
              emailVerified: true,
            });
          }
        }

        if (user && user.status === 'suspended') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended. Please contact system administration.',
          });
        }

        const requestedPortal = portal ? String(portal).toLowerCase().trim() : null;
        if (requestedPortal === 'admin') {
          if (user.role !== 'admin') {
            if (user.roleRequest?.status === 'pending') {
              return res.status(403).json({
                error: 'Forbidden',
                code: 'ADMIN_PENDING_APPROVAL',
                message: 'Your administrator account application is pending review by an authorized administrator.',
              });
            }
            return res.status(403).json({
              error: 'Forbidden',
              code: 'NOT_AN_ADMIN',
              message: 'Access Denied: This Google account does not possess Administrative privileges.',
            });
          }
        } else if (requestedPortal === 'user' || requestedPortal === 'farmer') {
          if (user.role === 'admin') {
            return res.status(403).json({
              error: 'Forbidden',
              code: 'ADMIN_PORTAL_REQUIRED',
              message: 'Administrator accounts must sign in using the Admin Login option.',
            });
          }
        }

        const token = generateToken({ id: user._id || user.id, tokenVersion: user.tokenVersion || 0 });
        return res.status(200).json({
          success: true,
          message: 'Google authentication successful',
          token,
          user: getSafeUser(user),
        });
      } catch (error) {
        if (error.status === 400 || error.status === 401 || error.status === 503) {
          return res.status(error.status).json({
            error: error.status === 401 ? 'Unauthorized' : error.status === 503 ? 'Service Unavailable' : 'Validation Error',
            message: error.message,
          });
        }
        return next(error);
      }
    },

    forgotPassword: async (req, res, next) => {
      try {
        const { email } = req.body || {};
        if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
          return invalid(res, 'A valid email address is required.');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const ip = getClientIp(req);

        const rateLimitResult = resetRateLimiter(ip, normalizedEmail);
        const isAllowed =
          typeof rateLimitResult === 'boolean'
            ? rateLimitResult
            : rateLimitResult?.allowed !== false;

        if (!isAllowed) {
          const retryAfter =
            typeof rateLimitResult === 'object' && rateLimitResult?.retryAfterSeconds
              ? rateLimitResult.retryAfterSeconds
              : 900;
          res.set('Retry-After', String(retryAfter));
          const message =
            (typeof rateLimitResult === 'object' && rateLimitResult?.message) ||
            'Too many password reset requests. Please try again later.';

          return res.status(429).json({
            error: 'Too Many Requests',
            message,
            retryAfter,
          });
        }

        const user = await userStore.findByEmail(normalizedEmail);

        const genericResponse = {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        };

        if (!user) {
          // Generic response to prevent user enumeration
          return res.status(200).json(genericResponse);
        }

        const userId = user._id || user.id;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await userStore.setResetPasswordToken(userId, hashedToken, expiresAt);

        try {
          await emailService.sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetToken: rawToken,
          });
        } catch (deliveryError) {
          // Invalidate the reset token since delivery failed
          await userStore.setResetPasswordToken(userId, null, null);
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Failed to deliver password reset email. Please try again later or contact support.',
          });
        }

        return res.status(200).json(genericResponse);
      } catch (error) {
        return next(error);
      }
    },

    resetPassword: async (req, res, next) => {
      try {
        const { token, password } = req.body || {};
        if (typeof token !== 'string' || !token.trim()) {
          return invalid(res, 'Password reset token is required.');
        }
        if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
          return invalid(res, 'Password must contain 10 to 128 characters.');
        }

        const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const user = await userStore.findByResetToken(hashedToken);

        if (!user) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Password reset token is invalid, expired, or has already been used.',
          });
        }

        const userId = user._id || user.id;
        await userStore.resetPasswordWithToken(userId, password);

        return res.status(200).json({
          success: true,
          message: 'Password reset successful. Please sign in with your new password.',
        });
      } catch (error) {
        return next(error);
      }
    },

    checkVerifyEmail: async (req, res, next) => {
      try {
        const { token } = req.query || {};
        if (typeof token !== 'string' || !token.trim()) {
          return invalid(res, 'Verification token is required.');
        }

        const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const user = await userStore.findByVerificationToken(hashedToken);

        if (!user) {
          return res.status(400).json({
            error: 'Validation Error',
            code: 'INVALID_OR_EXPIRED_TOKEN',
            valid: false,
            message: 'Verification link is invalid, expired, or has already been used.',
          });
        }

        return res.status(200).json({
          success: true,
          valid: true,
          email: maskEmail(user.email),
          message: 'Verification token is valid. Please confirm email verification.',
        });
      } catch (error) {
        return next(error);
      }
    },

    verifyEmail: async (req, res, next) => {
      try {
        const { token } = req.body || {};
        if (typeof token !== 'string' || !token.trim()) {
          return invalid(res, 'Verification token is required.');
        }

        const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const user = await userStore.findByVerificationToken(hashedToken);

        if (!user) {
          return res.status(400).json({
            error: 'Validation Error',
            code: 'INVALID_OR_EXPIRED_TOKEN',
            message: 'Verification link is invalid, expired, or has already been used.',
          });
        }

        const userId = user._id || user.id;
        const verifiedUser = await userStore.verifyEmailWithToken(userId, hashedToken);

        if (!verifiedUser) {
          return res.status(400).json({
            error: 'Validation Error',
            code: 'TOKEN_ALREADY_USED',
            message: 'This verification token has already been used or has expired.',
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Email verified successfully. You can now log in to your account.',
          user: getSafeUser(verifiedUser),
        });
      } catch (error) {
        return next(error);
      }
    },

    resendVerification: async (req, res, next) => {
      try {
        const { email } = req.body || {};
        if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
          return invalid(res, 'A valid email address is required.');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const ip = getClientIp(req);

        const rateLimitResult = verificationRateLimiter(ip, normalizedEmail);
        const isAllowed =
          typeof rateLimitResult === 'boolean'
            ? rateLimitResult
            : rateLimitResult?.allowed !== false;

        if (!isAllowed) {
          const retryAfter =
            typeof rateLimitResult === 'object' && rateLimitResult?.retryAfterSeconds
              ? rateLimitResult.retryAfterSeconds
              : 900;
          res.set('Retry-After', String(retryAfter));
          const message =
            (typeof rateLimitResult === 'object' && rateLimitResult?.message) ||
            'Too many verification requests. Please try again later.';

          return res.status(429).json({
            error: 'Too Many Requests',
            message,
            retryAfter,
          });
        }

        const genericSuccess = {
          success: true,
          message: 'If an unverified account with that email exists, a verification link has been sent.',
        };

        const user = await userStore.findByEmail(normalizedEmail, { includeSecrets: true });

        if (!user) {
          return res.status(200).json(genericSuccess);
        }

        if (user.emailVerified === true) {
          return res.status(200).json({
            success: true,
            alreadyVerified: true,
            message: 'This email is already verified. You can log in directly.',
          });
        }

        const userId = user._id || user.id;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await userStore.setEmailVerificationToken(userId, hashedToken, expiresAt);

        try {
          await emailService.sendVerificationEmail({
            to: user.email,
            name: user.name,
            verificationToken: rawToken,
          });
        } catch (deliveryError) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Failed to deliver verification email. Please try again later.',
          });
        }

        return res.status(200).json({
          success: true,
          message: 'A verification link has been sent to your email address.',
        });
      } catch (error) {
        return next(error);
      }
    },

    getMe: (req, res) => res.status(200).json({
      success: true,
      user: getSafeUser(req.user),
    }),

    updateProfile: async (req, res, next) => {
      try {
        if (req.user && req.user.role === 'admin') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'ADMIN_SELF_MODIFICATION_RESTRICTED',
            message: 'Administrators cannot modify their own profile. Profile changes must be performed by another administrator.',
          });
        }

        const userId = req.user._id || req.user.id;
        const { name, phone, address, farmName, farmSizeHectares, primaryCrops, language } = req.body || {};

        if (name !== undefined) {
          if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
            return invalid(res, 'Name must contain 1 to 50 characters.');
          }
        }
        if (language !== undefined) {
          const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'];
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return invalid(res, 'Language must be one of: ' + SUPPORTED_LANGUAGES.join(', ') + '.');
          }
        }
        if (phone !== undefined && phone !== null && phone !== '') {
          if (typeof phone !== 'string' || phone.trim().length > 30) {
            return invalid(res, 'Phone number must be at most 30 characters.');
          }
        }
        if (address !== undefined && address !== null && address !== '') {
          if (typeof address !== 'string' || address.trim().length > 200) {
            return invalid(res, 'Address must be at most 200 characters.');
          }
        }
        if (farmName !== undefined && farmName !== null && farmName !== '') {
          if (typeof farmName !== 'string' || farmName.trim().length > 100) {
            return invalid(res, 'Farm name must be at most 100 characters.');
          }
        }

        const updated = await userStore.updateProfile(userId, {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(language !== undefined ? { language } : {}),
          ...(phone !== undefined ? { phone: phone ? phone.trim() : '' } : {}),
          ...(address !== undefined ? { address: address ? address.trim() : '' } : {}),
          ...(farmName !== undefined ? { farmName: farmName ? farmName.trim() : '' } : {}),
          ...(farmSizeHectares !== undefined && farmSizeHectares !== '' ? { farmSizeHectares: Number(farmSizeHectares) } : {}),
          ...(primaryCrops !== undefined ? { primaryCrops: Array.isArray(primaryCrops) ? primaryCrops.map((c) => c.trim()) : [] } : {}),
        });

        if (!updated) {
          return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully.',
          user: getSafeUser(updated),
        });
      } catch (error) {
        return next(error);
      }
    },

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

    deleteAccount: async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        }

        const userId = req.user._id || req.user.id;
        const user = await userStore.findById(userId, { includePassword: true });
        if (!user) {
          return res.status(404).json({ error: 'Not Found', message: 'User account not found.' });
        }

        const { password, confirmation, confirmEmail } = req.body || {};

        // 1. Explicit confirmation check
        const isExplicitlyConfirmed =
          confirmation === 'DELETE' ||
          confirmation === true ||
          (typeof confirmEmail === 'string' && confirmEmail.trim().toLowerCase() === user.email.toLowerCase());

        if (!isExplicitlyConfirmed) {
          return res.status(400).json({
            error: 'Bad Request',
            code: 'CONFIRMATION_REQUIRED',
            message: 'Explicit confirmation is required to permanently delete your account.',
          });
        }

        // 2. Reauthentication check
        if (user.password) {
          if (!password || typeof password !== 'string') {
            return res.status(401).json({
              error: 'Unauthorized',
              code: 'PASSWORD_REQUIRED',
              message: 'Password reauthentication is required to permanently delete your account.',
            });
          }

          const isValidPassword = await userStore.verifyPassword(user, password);
          if (!isValidPassword) {
            return res.status(401).json({
              error: 'Unauthorized',
              code: 'INVALID_CREDENTIALS',
              message: 'Incorrect password. Account deletion cannot proceed.',
            });
          }
        } else if (user.googleId) {
          if (!confirmEmail || typeof confirmEmail !== 'string' || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
            return res.status(401).json({
              error: 'Unauthorized',
              code: 'EMAIL_CONFIRMATION_REQUIRED',
              message: 'Please enter your exact email address to confirm identity for account deletion.',
            });
          }
        }

        // 3. Admin last-admin protection check
        if (user.role === 'admin' && user.status !== 'suspended') {
          const activeAdmins = await userStore.countActiveAdmins();
          if (activeAdmins <= 1) {
            return res.status(403).json({
              error: 'Forbidden',
              code: 'LAST_ADMIN_PROTECTION',
              message: 'Cannot delete the last active administrator account. Another active administrator must exist or be appointed before this account can be deleted.',
            });
          }
        }

        // 4. Perform complete permanent account deletion
        const ip = getClientIp(req);
        await userStore.deleteAccount({
          userId,
          actor: user,
          ipAddress: ip,
          reason: 'User confirmed permanent account deletion',
        });

        return res.status(200).json({
          success: true,
          message: 'Your account and all associated data have been permanently deleted.',
        });
      } catch (error) {
        if (error.code === 'LAST_ADMIN_PROTECTION') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'LAST_ADMIN_PROTECTION',
            message: error.message,
          });
        }
        return next(error);
      }
    },
  };
};

export default createAuthController;
