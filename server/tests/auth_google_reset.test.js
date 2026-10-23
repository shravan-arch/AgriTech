import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.CLIENT_URL = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');

const asJson = (record) => ({
  ...record,
  toJSON() {
    const { password, resetPasswordToken, resetPasswordExpires, ...safe } = this;
    return safe;
  },
});

const createMemoryUserStore = () => {
  const users = new Map();
  let nextId = 1;
  const generateId = () => (nextId++).toString(16).padStart(24, '0');

  const userStore = {
    async create(values) {
      const email = values.email.toLowerCase().trim();
      if (users.has(email)) {
        const error = new Error('Duplicate test email.');
        error.code = 11000;
        throw error;
      }
      const user = asJson({
        ...values,
        email,
        _id: generateId(),
        id: null,
        role: 'farmer',
        async comparePassword(password) {
          if (!this.password) return false;
          return bcrypt.compare(password, this.password);
        },
      });
      user.id = user._id;
      if (values.password) {
        user.password = await bcrypt.hash(values.password, 4);
      }
      users.set(email, user);
      return user;
    },

    async findByEmail(email, { includeSecrets = false } = {}) {
      const normalized = email.toLowerCase().trim();
      return users.get(normalized) || null;
    },

    async findByGoogleId(googleId) {
      if (!googleId) return null;
      return [...users.values()].find((u) => u.googleId === googleId) || null;
    },

    async linkGoogleAccount(userId, googleId) {
      const user = [...users.values()].find((u) => u._id === userId);
      if (!user) return null;
      user.googleId = googleId;
      return user;
    },

    async findById(userId) {
      return [...users.values()].find((user) => user._id === userId) || null;
    },

    async findOwnedById(targetId, requesterId, isAdmin) {
      const user = await this.findById(targetId);
      return user && (isAdmin || targetId === requesterId) ? user : null;
    },

    async setResetPasswordToken(userId, hashedToken, expiresAt) {
      const user = [...users.values()].find((u) => u._id === userId);
      if (!user) return null;
      user.resetPasswordToken = hashedToken || undefined;
      user.resetPasswordExpires = expiresAt || undefined;
      return user;
    },

    async findByResetToken(hashedToken) {
      if (!hashedToken) return null;
      const now = new Date();
      return (
        [...users.values()].find(
          (u) =>
            u.resetPasswordToken === hashedToken &&
            u.resetPasswordExpires &&
            new Date(u.resetPasswordExpires) > now
        ) || null
      );
    },

    async resetPasswordWithToken(userId, newPassword) {
      const user = [...users.values()].find((u) => u._id === userId);
      if (!user) return null;
      user.password = await bcrypt.hash(newPassword, 4);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.passwordChangedAt = new Date();
      return user;
    },

    verifyPassword(user, password) {
      if (!user || !user.password) return false;
      return bcrypt.compare(password, user.password);
    },
  };

  return { userStore, users };
};

describe('Google Sign-In and Password Reset Flows', () => {
  let server;
  let baseUrl;
  let userStore;
  let sentEmails = [];
  let shouldFailEmailDelivery = false;
  let customGooglePayloads = new Map();

  const mockEmailService = {
    async sendPasswordResetEmail({ to, name, resetToken }) {
      if (shouldFailEmailDelivery) {
        throw new Error('SMTP connection timeout');
      }
      sentEmails.push({ to, name, resetToken });
      return true;
    },
  };

  const mockGoogleAuthService = {
    async verifyGoogleIdToken(token) {
      if (customGooglePayloads.has(token)) {
        return customGooglePayloads.get(token);
      }
      if (token === 'invalid-google-token') {
        const error = new Error('Invalid or expired Google identity token.');
        error.status = 401;
        throw error;
      }
      if (token === 'unverified-email-token') {
        return {
          sub: 'google-sub-unverified',
          email: 'unverified@test.farm',
          email_verified: false,
          name: 'Unverified Farmer',
        };
      }
      if (token === 'valid-google-token-1') {
        return {
          sub: 'google-sub-12345',
          email: 'googlefarmer@test.farm',
          email_verified: true,
          name: 'Green Field Farmer',
        };
      }
      if (token === 'valid-google-token-link') {
        return {
          sub: 'google-sub-link-999',
          email: 'existing@test.farm',
          email_verified: true,
          name: 'Existing Account Owner',
        };
      }
      const error = new Error('Unknown Google identity token.');
      error.status = 401;
      throw error;
    },
  };

  before(async () => {
    const memoryStores = createMemoryUserStore();
    userStore = memoryStores.userStore;

    // Seed existing password-based account for linking tests
    await userStore.create({
      name: 'Existing Farmer',
      email: 'existing@test.farm',
      password: 'OriginalPassword123!',
      role: 'farmer',
      farmName: 'Heritage Homestead',
    });

    const app = createApp({
      userStore,
      emailService: mockEmailService,
      googleAuthService: mockGoogleAuthService,
    });

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  const request = async (method, route, body, token) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };

  describe('Google OAuth / Sign-In Endpoint', () => {
    test('rejects missing or empty token with 400', async () => {
      const res = await request('POST', '/api/auth/google', {});
      assert.equal(res.status, 400);
      assert.equal(res.data.error, 'Validation Error');
    });

    test('rejects invalid or forged Google identity token with 401', async () => {
      const res = await request('POST', '/api/auth/google', {
        credential: 'invalid-google-token',
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.error, 'Unauthorized');
      assert.match(res.data.message, /invalid or expired/i);
    });

    test('rejects Google account if email is not verified', async () => {
      const res = await request('POST', '/api/auth/google', {
        credential: 'unverified-email-token',
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.error, 'Unauthorized');
      assert.match(res.data.message, /not verified/i);
    });

    test('registers new farmer from verified Google token with strictly default role', async () => {
      const res = await request('POST', '/api/auth/google', {
        credential: 'valid-google-token-1',
        role: 'admin', // Attempted role escalation via request body
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.token, 'Should return a valid JWT token');
      assert.equal(res.data.user.email, 'googlefarmer@test.farm');
      assert.equal(res.data.user.name, 'Green Field Farmer');
      assert.equal(res.data.user.role, 'farmer', 'New registration must be strictly farmer');
      assert.equal(res.data.user.googleId, 'google-sub-12345');
      assert.equal(res.data.user.password, undefined, 'Password must not be returned');

      // Verify token allows accessing protected route /api/auth/me
      const profile = await request('GET', '/api/auth/me', undefined, res.data.token);
      assert.equal(profile.status, 200);
      assert.equal(profile.data.user.email, 'googlefarmer@test.farm');
    });

    test('subsequent Google sign-in returns existing account without duplicates', async () => {
      const res = await request('POST', '/api/auth/google', {
        credential: 'valid-google-token-1',
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.user.email, 'googlefarmer@test.farm');
      assert.equal(res.data.user.googleId, 'google-sub-12345');
    });

    test('safely links existing email/password account using verified Google provider ID', async () => {
      // User exists with email 'existing@test.farm' and has a password
      const initialUser = await userStore.findByEmail('existing@test.farm');
      assert.ok(initialUser);
      assert.equal(initialUser.googleId, undefined);

      const res = await request('POST', '/api/auth/google', {
        credential: 'valid-google-token-link',
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.user.email, 'existing@test.farm');
      assert.equal(res.data.user.id, initialUser.id, 'User ID must be preserved');

      // Check that existing password login still works
      const loginRes = await request('POST', '/api/auth/login', {
        email: 'existing@test.farm',
        password: 'OriginalPassword123!',
      });
      assert.equal(loginRes.status, 200, 'Existing password login must remain functional');
    });
  });

  describe('Forgot Password & Token Generation', () => {
    test('rejects invalid email formats', async () => {
      const res = await request('POST', '/api/auth/forgot-password', { email: 'not-an-email' });
      assert.equal(res.status, 400);
      assert.equal(res.data.error, 'Validation Error');
    });

    test('returns generic success for unknown email (prevents account enumeration)', async () => {
      sentEmails = [];
      const res = await request('POST', '/api/auth/forgot-password', {
        email: 'nonexistent@ghost.farm',
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.match(res.data.message, /if an account with that email exists/i);
      assert.equal(sentEmails.length, 0, 'No email sent for non-existent account');
    });

    test('generates secure hashed token and sends email for existing account', async () => {
      sentEmails = [];
      const res = await request('POST', '/api/auth/forgot-password', {
        email: 'existing@test.farm',
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, 'existing@test.farm');

      const rawToken = sentEmails[0].resetToken;
      assert.ok(rawToken && rawToken.length >= 64, 'Raw token must be high-entropy hex string');

      // Verify that stored token on user is a SHA-256 hash, not the raw token
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const user = await userStore.findByEmail('existing@test.farm');
      assert.equal(user.resetPasswordToken, expectedHash, 'Token must be stored as SHA-256 hash');
      assert.ok(new Date(user.resetPasswordExpires) > new Date(), 'Expiry must be in the future');
    });

    test('handles email delivery failure honestly and does not report false success', async () => {
      shouldFailEmailDelivery = true;
      try {
        const res = await request('POST', '/api/auth/forgot-password', {
          email: 'existing@test.farm',
        });
        assert.equal(res.status, 503);
        assert.equal(res.data.error, 'Service Unavailable');
        assert.match(res.data.message, /failed to deliver/i);

        // Verify that the reset token was invalidated upon failure
        const user = await userStore.findByEmail('existing@test.farm');
        assert.equal(user.resetPasswordToken, undefined);
      } finally {
        shouldFailEmailDelivery = false;
      }
    });

    test('enforces rate limiting when request threshold is exceeded and returns Retry-After header', async () => {
      let now = 1000000;
      const { createRateLimiter } = await import('../src/controllers/authController.js');
      // Create limiter allowing 2 requests per email with 5000ms window
      const testLimiter = createRateLimiter({
        windowMs: 5000,
        maxPerEmail: 2,
        maxPerIp: 10,
      });

      const limitedApp = createApp({
        userStore,
        emailService: mockEmailService,
        rateLimiter: (ip, email) => testLimiter(ip, email, now),
      });

      const limitedServer = limitedApp.listen(0);
      const port = limitedServer.address().port;

      try {
        // Request 1: allowed
        const res1 = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user-limit@test.farm' }),
        });
        assert.equal(res1.status, 200);

        // Request 2: allowed
        const res2 = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user-limit@test.farm' }),
        });
        assert.equal(res2.status, 200);

        // Request 3: blocked (exceeds maxPerEmail: 2)
        const res3 = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user-limit@test.farm' }),
        });
        assert.equal(res3.status, 429);
        assert.ok(res3.headers.get('Retry-After'), 'Should include Retry-After header');
        const data3 = await res3.json();
        assert.equal(data3.error, 'Too Many Requests');
        assert.match(data3.message, /too many/i);
        assert.ok(data3.retryAfter > 0);

        // Advance time past the 5000ms window
        now += 6000;

        // Request 4: allowed again after window expires
        const res4 = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user-limit@test.farm' }),
        });
        assert.equal(res4.status, 200, 'Request should succeed after window expires');
      } finally {
        await new Promise((resolve) => limitedServer.close(resolve));
      }
    });

    test('dual-keying ensures that hitting the limit for one account does not lock out other accounts on the same IP', async () => {
      const { createRateLimiter } = await import('../src/controllers/authController.js');
      // Limiter allowing 2 per email, but 10 per IP
      const testLimiter = createRateLimiter({
        windowMs: 60000,
        maxPerEmail: 2,
        maxPerIp: 10,
      });

      const limitedApp = createApp({
        userStore,
        emailService: mockEmailService,
        rateLimiter: (ip, email) => testLimiter(ip, email),
      });

      const limitedServer = limitedApp.listen(0);
      const port = limitedServer.address().port;

      try {
        // Exhaust limit for account A
        await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'account-a@test.farm' }),
        });
        await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'account-a@test.farm' }),
        });
        const blockedA = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'account-a@test.farm' }),
        });
        assert.equal(blockedA.status, 429, 'Account A should be rate-limited');

        // Account B from the SAME IP address must NOT be blocked
        const allowedB = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'account-b@test.farm' }),
        });
        assert.equal(allowedB.status, 200, 'Account B must not be blocked by Account A hitting its limit');
      } finally {
        await new Promise((resolve) => limitedServer.close(resolve));
      }
    });

    test('invalid email format returns 400 without consuming rate limit quota', async () => {
      const { createRateLimiter } = await import('../src/controllers/authController.js');
      const testLimiter = createRateLimiter({
        windowMs: 60000,
        maxPerEmail: 1,
        maxPerIp: 1,
      });

      const limitedApp = createApp({
        userStore,
        emailService: mockEmailService,
        rateLimiter: (ip, email) => testLimiter(ip, email),
      });

      const limitedServer = limitedApp.listen(0);
      const port = limitedServer.address().port;

      try {
        // Send malformed email (should return 400)
        const badReq = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'not-valid-email' }),
        });
        assert.equal(badReq.status, 400);

        // Send valid request: should still be allowed because quota was not consumed by the 400
        const goodReq = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'valid-quota@test.farm' }),
        });
        assert.equal(goodReq.status, 200);
      } finally {
        await new Promise((resolve) => limitedServer.close(resolve));
      }
    });

    test('anti-enumeration: identical response returned for existing and non-existent accounts', async () => {
      const resExisting = await request('POST', '/api/auth/forgot-password', {
        email: 'existing@test.farm',
      });
      const resNonExistent = await request('POST', '/api/auth/forgot-password', {
        email: 'completely-nonexistent-123456@test.farm',
      });

      assert.equal(resExisting.status, 200);
      assert.equal(resNonExistent.status, 200);
      assert.deepEqual(resExisting.data, resNonExistent.data);
      assert.match(resExisting.data.message, /if an account with that email exists/i);
    });
  });

  describe('Reset Password Execution & Security', () => {
    let validResetToken;

    before(async () => {
      sentEmails = [];
      // Request a fresh reset token for existing@test.farm
      await request('POST', '/api/auth/forgot-password', {
        email: 'existing@test.farm',
      });
      validResetToken = sentEmails[0].resetToken;
    });

    test('rejects missing or empty token with 400', async () => {
      const res = await request('POST', '/api/auth/reset-password', {
        password: 'BrandNewPassword123!',
      });
      assert.equal(res.status, 400);
    });

    test('rejects passwords shorter than 10 characters', async () => {
      const res = await request('POST', '/api/auth/reset-password', {
        token: validResetToken,
        password: 'short',
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /10 to 128 characters/i);
    });

    test('rejects forged or incorrect reset token', async () => {
      const res = await request('POST', '/api/auth/reset-password', {
        token: 'wrong-and-forged-token-0000000000000000000000000000000000000000',
        password: 'BrandNewPassword123!',
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /invalid, expired, or has already been used/i);
    });

    test('rejects expired reset token', async () => {
      // Manually set expiry to the past
      const user = await userStore.findByEmail('existing@test.farm');
      user.resetPasswordExpires = new Date(Date.now() - 10000);

      const res = await request('POST', '/api/auth/reset-password', {
        token: validResetToken,
        password: 'BrandNewPassword123!',
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /invalid, expired, or has already been used/i);
    });

    test('successfully resets password with valid token and invalidates token after single use', async () => {
      // Request fresh token
      sentEmails = [];
      await request('POST', '/api/auth/forgot-password', {
        email: 'existing@test.farm',
      });
      const freshToken = sentEmails[0].resetToken;

      // Also get a session token with the OLD password
      const oldLogin = await request('POST', '/api/auth/login', {
        email: 'existing@test.farm',
        password: 'OriginalPassword123!',
      });
      assert.equal(oldLogin.status, 200);
      const oldJwt = oldLogin.data.token;

      // Ensure second boundary has elapsed so old JWT iat < passwordChangedTimestamp
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Execute password reset
      const resetRes = await request('POST', '/api/auth/reset-password', {
        token: freshToken,
        password: 'BrandNewSecurePassword123!',
      });

      assert.equal(resetRes.status, 200);
      assert.equal(resetRes.data.success, true);

      // Verify token reuse is immediately rejected (single-use)
      const reuseRes = await request('POST', '/api/auth/reset-password', {
        token: freshToken,
        password: 'AnotherPassword123!',
      });
      assert.equal(reuseRes.status, 400, 'Reused token must be rejected');

      // Verify login with old password fails
      const failedLogin = await request('POST', '/api/auth/login', {
        email: 'existing@test.farm',
        password: 'OriginalPassword123!',
      });
      assert.equal(failedLogin.status, 401);

      // Verify login with new password succeeds
      const newLogin = await request('POST', '/api/auth/login', {
        email: 'existing@test.farm',
        password: 'BrandNewSecurePassword123!',
      });
      assert.equal(newLogin.status, 200);

      // Session Invalidation: Verify old JWT issued prior to password change is rejected
      const meWithOldJwt = await request('GET', '/api/auth/me', undefined, oldJwt);
      assert.equal(
        meWithOldJwt.status,
        401,
        'Old JWT sessions must be invalidated after password change'
      );
      assert.match(meWithOldJwt.data.message, /recently changed/i);

      // Verify new JWT works
      const meWithNewJwt = await request('GET', '/api/auth/me', undefined, newLogin.data.token);
      assert.equal(meWithNewJwt.status, 200);
      assert.equal(meWithNewJwt.data.user.email, 'existing@test.farm');
    });
  });
});
