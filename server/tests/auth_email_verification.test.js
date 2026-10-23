import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.CLIENT_URL = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { createAuthRouter } = await import('../src/routes/auth.js');
const { createAuthController, createRateLimiter } = await import('../src/controllers/authController.js');

const asJson = (record) => ({
  ...record,
  toJSON() {
    const { password, resetPasswordToken, resetPasswordExpires, emailVerificationToken, emailVerificationExpires, ...safe } = this;
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
        emailVerified: values.emailVerified === true,
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

    async findByEmail(email) {
      return users.get(email.toLowerCase().trim()) || null;
    },

    async findById(id) {
      return [...users.values()].find((u) => u._id === id || u.id === id) || null;
    },

    async findByGoogleId(googleId) {
      return [...users.values()].find((u) => u.googleId === googleId) || null;
    },

    async linkGoogleAccount(userId, googleId) {
      const user = await this.findById(userId);
      if (!user) return null;
      user.googleId = googleId;
      user.emailVerified = true;
      return user;
    },

    async setEmailVerificationToken(userId, hashedToken, expiresAt) {
      const user = await this.findById(userId);
      if (!user) return null;
      if (hashedToken) {
        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = expiresAt;
      } else {
        delete user.emailVerificationToken;
        delete user.emailVerificationExpires;
      }
      return user;
    },

    async findByVerificationToken(hashedToken) {
      if (!hashedToken) return null;
      const now = new Date();
      return (
        [...users.values()].find(
          (u) =>
            u.emailVerificationToken === hashedToken &&
            u.emailVerificationExpires &&
            new Date(u.emailVerificationExpires) > now
        ) || null
      );
    },

    async verifyEmailWithToken(userId, hashedToken) {
      const user = await this.findById(userId);
      if (!user) return null;
      const now = new Date();
      if (
        user.emailVerificationToken !== hashedToken ||
        !user.emailVerificationExpires ||
        new Date(user.emailVerificationExpires) <= now
      ) {
        return null;
      }
      user.emailVerified = true;
      delete user.emailVerificationToken;
      delete user.emailVerificationExpires;
      return user;
    },

    async updateUnverifiedUser(userId, updateData) {
      const user = await this.findById(userId);
      if (!user || user.emailVerified) return null;
      if (updateData.name) user.name = updateData.name;
      if (updateData.password) {
        user.password = await bcrypt.hash(updateData.password, 4);
      }
      if (updateData.farmName !== undefined) user.farmName = updateData.farmName;
      if (updateData.farmSizeHectares !== undefined) user.farmSizeHectares = updateData.farmSizeHectares;
      if (updateData.primaryCrops !== undefined) user.primaryCrops = updateData.primaryCrops;
      if (updateData.emailVerificationToken !== undefined) {
        user.emailVerificationToken = updateData.emailVerificationToken;
      }
      if (updateData.emailVerificationExpires !== undefined) {
        user.emailVerificationExpires = updateData.emailVerificationExpires;
      }
      return user;
    },

    async updateProfile(userId, updateData) {
      const user = await this.findById(userId);
      if (!user) return null;
      if (updateData.name !== undefined) user.name = updateData.name;
      if (updateData.phone !== undefined) user.phone = updateData.phone;
      if (updateData.address !== undefined) user.address = updateData.address;
      if (updateData.farmName !== undefined) user.farmName = updateData.farmName;
      if (updateData.farmSizeHectares !== undefined) user.farmSizeHectares = updateData.farmSizeHectares;
      if (updateData.primaryCrops !== undefined) user.primaryCrops = updateData.primaryCrops;
      return user;
    },

    verifyPassword(user, password) {
      return user.comparePassword(password);
    },

    _getAllUsers() {
      return [...users.values()];
    },
  };

  return userStore;
};

describe('Email Verification Flow for AgriTech Registration', () => {
  let userStore;
  let sentEmails;
  let mockEmailService;
  let mockGoogleService;
  let app;
  let server;
  let baseUrl;

  before(async () => {
    userStore = createMemoryUserStore();
    sentEmails = [];

    mockEmailService = {
      sendVerificationEmail: async (params) => {
        if (mockEmailService.shouldFail) {
          throw new Error('SMTP connection timed out');
        }
        sentEmails.push(params);
        return true;
      },
      sendPasswordResetEmail: async () => true,
    };

    mockGoogleService = {
      verifyGoogleIdToken: async (token) => {
        if (token === 'valid-google-token') {
          return {
            sub: 'google-uid-1001',
            email: 'googlefarmer@example.com',
            email_verified: true,
            name: 'Google Farmer',
          };
        }
        const error = new Error('Invalid token');
        error.status = 401;
        throw error;
      },
    };

    // Create app with explicit requireEmailVerification: true
    const expressApp = (await import('express')).default;
    app = expressApp();
    app.use(expressApp.json());

    const verificationRateLimiter = createRateLimiter({
      windowMs: 15 * 60 * 1000,
      maxPerEmail: 3,
      maxPerIp: 10,
    });

    const router = createAuthRouter(userStore, {
      emailService: mockEmailService,
      googleAuthService: mockGoogleService,
      verificationRateLimiter,
      requireEmailVerification: true,
    });
    app.use('/api/auth', router);

    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, () => resolve(instance));
      instance.on('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  let capturedVerificationToken = null;

  test('1. Registration creates an unverified account and dispatches verification email', async () => {
    sentEmails.length = 0;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Anita Verma',
        email: 'anita.verma@example.com',
        password: 'SecurePassword123!',
        farmName: 'Verma Organics',
        farmSizeHectares: 12.5,
        primaryCrops: ['Wheat', 'Mustard'],
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.requiresEmailVerification, true);
    assert.equal(typeof data.token, 'string', 'Returns session token so user can access profile and verify');
    assert.equal(data.user.emailVerified, false);
    assert.equal(data.user.role, 'farmer');

    // Email dispatch verification
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'anita.verma@example.com');
    assert.equal(typeof sentEmails[0].verificationToken, 'string');
    assert.equal(sentEmails[0].verificationToken.length, 64); // 32 bytes hex = 64 chars
    capturedVerificationToken = sentEmails[0].verificationToken;

    // Database verification: raw token must NOT be in DB
    const dbUser = await userStore.findByEmail('anita.verma@example.com');
    assert.ok(dbUser);
    assert.equal(dbUser.emailVerified, false);
    assert.notEqual(dbUser.emailVerificationToken, capturedVerificationToken, 'Raw token must not be in DB');

    const expectedHash = crypto.createHash('sha256').update(capturedVerificationToken).digest('hex');
    assert.equal(dbUser.emailVerificationToken, expectedHash, 'Only SHA-256 hash must be stored');

    // Expiry should be ~24 hours
    const expiry = new Date(dbUser.emailVerificationExpires).getTime();
    const now = Date.now();
    assert.ok(expiry > now + 23 * 3600 * 1000 && expiry <= now + 25 * 3600 * 1000);
  });

  test('2. Allows unverified password account to log in and access profile page', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'anita.verma@example.com',
        password: 'SecurePassword123!',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.emailVerified, false);
    assert.equal(typeof data.token, 'string');
  });

  test('2b. Allows user to update their profile with name, phone, address, and farmName', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'anita.verma@example.com',
        password: 'SecurePassword123!',
      }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const profileRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Anita Verma Updated',
        phone: '+91 98765 43210',
        address: 'Plot 44, Agro Park, Karnal',
        farmName: 'Verma Green Organics',
      }),
    });

    const profileData = await profileRes.json();
    assert.equal(profileRes.status, 200);
    assert.equal(profileData.success, true);
    assert.equal(profileData.user.name, 'Anita Verma Updated');
    assert.equal(profileData.user.phone, '+91 98765 43210');
    assert.equal(profileData.user.address, 'Plot 44, Agro Park, Karnal');
    assert.equal(profileData.user.farmName, 'Verma Green Organics');
  });

  test('3. Scanner pre-fetch safety: GET /api/auth/verify-email does NOT verify or mutate user state', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-email?token=${capturedVerificationToken}`, {
      method: 'GET',
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.valid, true);
    assert.ok(data.email.includes('*'), 'Email must be masked for privacy');

    // Confirm DB was NOT mutated: user must still be unverified!
    const dbUser = await userStore.findByEmail('anita.verma@example.com');
    assert.equal(dbUser.emailVerified, false, 'GET scanner check must not verify account');
    assert.ok(dbUser.emailVerificationToken, 'Token must not be cleared by GET check');
  });

  test('4. GET /api/auth/verify-email rejects invalid or forged tokens', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-email?token=invalid-random-token`, {
      method: 'GET',
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.valid, false);
  });

  test('5. POST /api/auth/verify-email verifies email and invalidates the token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: capturedVerificationToken }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.emailVerified, true);

    // Verify DB state
    const dbUser = await userStore.findByEmail('anita.verma@example.com');
    assert.equal(dbUser.emailVerified, true);
    assert.equal(dbUser.emailVerificationToken, undefined, 'Token must be cleared after use');
    assert.equal(dbUser.emailVerificationExpires, undefined, 'Expiry must be cleared after use');
  });

  test('6. Token reuse prevention: reusing the same token fails', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: capturedVerificationToken }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error, 'Validation Error');
  });

  test('7. Verified account can now log in normally', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'anita.verma@example.com',
        password: 'SecurePassword123!',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(typeof data.token, 'string');
    assert.equal(data.user.emailVerified, true);
  });

  test('8. Duplicate registration for already-verified account returns 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Anita Verma',
        email: 'anita.verma@example.com',
        password: 'AnotherPassword123!',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 409);
    assert.equal(data.error, 'Conflict');
  });

  test('9. Unverified registration retry re-issues token without duplicate accounts', async () => {
    // 9a: Register user 2
    sentEmails.length = 0;
    const reg1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Kumar',
        email: 'ramesh.kumar@example.com',
        password: 'RameshPassword123!',
      }),
    });
    assert.equal(reg1.status, 201);
    const firstToken = sentEmails[0].verificationToken;

    // 9b: User retries registration before verifying
    sentEmails.length = 0;
    const reg2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Kumar Updated',
        email: 'ramesh.kumar@example.com',
        password: 'RameshNewPassword123!',
      }),
    });
    const reg2Data = await reg2.json();
    assert.equal(reg2.status, 201);
    assert.equal(reg2Data.requiresEmailVerification, true);

    // Old token should be invalidated and replaced
    assert.equal(sentEmails.length, 1);
    const secondToken = sentEmails[0].verificationToken;
    assert.notEqual(secondToken, firstToken, 'New replacement token must be issued');

    // First token cannot verify anymore
    const verifyOld = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: firstToken }),
    });
    assert.equal(verifyOld.status, 400);

    // Second token verifies successfully
    const verifyNew = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: secondToken }),
    });
    assert.equal(verifyNew.status, 200);

    // Ensure only 1 user with that email exists in DB
    const allUsers = userStore._getAllUsers().filter((u) => u.email === 'ramesh.kumar@example.com');
    assert.equal(allUsers.length, 1, 'Must not create duplicate DB records');
  });

  test('10. Resend verification endpoint generates fresh token', async () => {
    // Register unverified user 3
    sentEmails.length = 0;
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sunita Devi',
        email: 'sunita.devi@example.com',
        password: 'SunitaPassword123!',
      }),
    });
    const token1 = sentEmails[0].verificationToken;

    sentEmails.length = 0;
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sunita.devi@example.com' }),
    });

    const resendData = await resendRes.json();
    assert.equal(resendRes.status, 200);
    assert.equal(resendData.success, true);
    assert.equal(sentEmails.length, 1);
    const token2 = sentEmails[0].verificationToken;
    assert.notEqual(token2, token1);

    // Verify token 2 works
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token2 }),
    });
    assert.equal(verifyRes.status, 200);
  });

  test('11. Resend endpoint anti-enumeration: unknown email returns identical generic success', async () => {
    sentEmails.length = 0;
    const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.farmer@example.com' }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(sentEmails.length, 0, 'No email should be sent for non-existent account');
  });

  test('12. Resend rate limiting: blocks excessive resend requests with 429 and Retry-After', async () => {
    // Register unverified user 4
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kavita Patel',
        email: 'kavita.patel@example.com',
        password: 'KavitaPassword123!',
      }),
    });

    // We set maxPerEmail to 3 in setup.
    // Call 1
    const r1 = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavita.patel@example.com' }),
    });
    assert.equal(r1.status, 200);

    // Call 2
    const r2 = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavita.patel@example.com' }),
    });
    assert.equal(r2.status, 200);

    // Call 3
    const r3 = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavita.patel@example.com' }),
    });
    assert.equal(r3.status, 200);

    // Call 4: should be rate limited!
    const r4 = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavita.patel@example.com' }),
    });
    assert.equal(r4.status, 429);
    assert.ok(r4.headers.get('Retry-After'));
    const r4Data = await r4.json();
    assert.equal(r4Data.error, 'Too Many Requests');
  });

  test('13. SMTP failure handling: reports 503 and does not mark account verified', async () => {
    mockEmailService.shouldFail = true;

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Fail Farmer',
        email: 'fail.farmer@example.com',
        password: 'FailPassword123!',
      }),
    });

    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.error, 'Service Unavailable');

    // User is created but unverified
    const dbUser = await userStore.findByEmail('fail.farmer@example.com');
    assert.ok(dbUser);
    assert.equal(dbUser.emailVerified, false);

    mockEmailService.shouldFail = false;
  });

  test('14. Google Sign-In automatically grants emailVerified: true', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'valid-google-token' }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.emailVerified, true);
    assert.equal(typeof data.token, 'string');

    const dbUser = await userStore.findByEmail('googlefarmer@example.com');
    assert.equal(dbUser.emailVerified, true);
  });
});
