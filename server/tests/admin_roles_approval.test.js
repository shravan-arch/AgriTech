import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';
import { userStore } from '../src/storage/userStore.js';
import { farmStore } from '../src/storage/farmStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDataDir = path.resolve(__dirname, '../data-test-admin-roles');

process.env.NODE_ENV = 'development';
process.env.STORAGE_MODE = 'local-json';
process.env.LOCAL_DATA_DIR = testDataDir;
process.env.JWT_SECRET = 'a3236853bbdae24819ed03d65410aaadbf07e1b3130bc84e54e2ac299f934ebdc051315aca2f0a40f34bfa9f3eeb8458';
process.env.CLIENT_URL = 'http://localhost:5173';

const { connectDB } = await import('../src/config/db.js');
await connectDB();

const cleanStorage = () => {
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
};

const makeMockEmailService = () => ({
  sentEmails: [],
  sendVerificationEmail: async (params) => {
    makeMockEmailService.lastSent = params;
    return true;
  },
  sendPasswordResetEmail: async (params) => {
    return true;
  },
});

test.before(() => {
  cleanStorage();
});

test.after(() => {
  cleanStorage();
});

test('Admin Access, Public Farmer-Only Registration, and Removed Role Promotion Suite', async (t) => {
  const emailService = makeMockEmailService();
  const app = createApp({
    userStore,
    farmStore,
    emailService,
  });

  const request = async (route, options = {}) => {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, body: data, headers: response.headers };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  };

  let rootAdminToken;
  let rootAdminId;

  await t.test('1. Registration with standard fields creates a farmer account', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Normal Farmer',
        email: 'farmer@example.com',
        password: 'Password12345!',
        language: 'hi',
      }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'farmer');
    assert.equal(res.body.user.language, 'hi');
    assert.equal(res.body.requiresAdminApproval, undefined);
    assert.equal(res.body.user.roleRequest, undefined);
    assert.ok(res.body.token);

    // Verify newly registered farmer can access farmer profile
    const profileRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${res.body.token}` },
    });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.user.role, 'farmer');
  });

  await t.test('2. Public registration ignores attempted role elevation and strictly creates a farmer account', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Applicant Admin',
        email: 'applicant@example.com',
        password: 'Password12345!',
        role: 'admin',
        selectedRole: 'admin',
        requestedRole: 'admin',
        language: 'en',
      }),
    });

    assert.equal(res.status, 201);
    // CRITICAL: Public registration must strictly create a farmer account!
    assert.equal(res.body.user.role, 'farmer');
    assert.equal(res.body.requiresAdminApproval, undefined);
    assert.equal(res.body.user.roleRequest, undefined);
    assert.ok(res.body.token);

    // Verify applicant cannot access admin routes
    const adminCheck = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${res.body.token}` },
    });
    assert.equal(adminCheck.status, 403);
  });

  await t.test('3. Non-admin accounts receive 403 Forbidden when calling admin endpoints', async () => {
    const reg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Standard User',
        email: 'user@example.com',
        password: 'Password12345!',
      }),
    });

    const res = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${reg.body.token}` },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /not permitted/i);
  });

  await t.test('4. First admin bootstrap establishes root admin and disables subsequent bootstrap', async () => {
    const bootstrapRes = await request('/api/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Root Admin',
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });

    assert.equal(bootstrapRes.status, 200);
    assert.equal(bootstrapRes.body.user.role, 'admin');

    // Subsequent bootstrap attempt must be rejected
    const secondBootstrap = await request('/api/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Imposter Admin',
        email: 'imposter@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });

    assert.equal(secondBootstrap.status, 403);
    assert.equal(secondBootstrap.body.code, 'BOOTSTRAP_DISABLED');
  });

  await t.test('5. Existing Admin can log in via admin portal and access admin endpoints', async () => {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
        portal: 'admin',
      }),
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.role, 'admin');
    rootAdminToken = loginRes.body.token;
    rootAdminId = loginRes.body.user._id || loginRes.body.user.id;

    // Admin can access admin users list
    const usersRes = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${rootAdminToken}` },
    });
    assert.equal(usersRes.status, 200);
    assert.ok(Array.isArray(usersRes.body.users));

    // Admin can access system health
    const healthRes = await request('/api/admin/system-health', {
      headers: { Authorization: `Bearer ${rootAdminToken}` },
    });
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.health.status, 'healthy');
  });

  await t.test('6. Removed Admin-request and role-promotion endpoints return 404 Not Found', async () => {
    const removedEndpoints = [
      { method: 'GET', path: '/api/admin/pending-requests' },
      { method: 'POST', path: '/api/admin/requests/any-id/approve' },
      { method: 'POST', path: '/api/admin/requests/any-id/reject' },
      { method: 'POST', path: '/api/admin/users/any-id/approve' },
      { method: 'POST', path: '/api/admin/users/any-id/reject' },
      { method: 'PUT', path: '/api/admin/users/any-id/role' },
    ];

    for (const endpoint of removedEndpoints) {
      const res = await request(endpoint.path, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${rootAdminToken}` },
        body: endpoint.method !== 'GET' ? JSON.stringify({ reason: 'testing' }) : undefined,
      });
      assert.equal(res.status, 404, `Expected 404 for removed endpoint ${endpoint.method} ${endpoint.path}`);
    }
  });

  await t.test('7. Admins cannot suspend themselves (self-protection)', async () => {
    const selfSuspend = await request(`/api/admin/users/${rootAdminId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(selfSuspend.status, 403);
  });

  await t.test('8. Last active Admin protection: store prevents suspending sole remaining admin', async () => {
    await assert.rejects(
      async () => {
        await userStore.updateUserStatus({
          targetUserId: rootAdminId,
          status: 'suspended',
          actor: { id: 'external', email: 'external@test.com', name: 'External' },
        });
      },
      (err) => err.code === 'LAST_ADMIN_PROTECTION'
    );
  });

  await t.test('9. Admin user management assistance (status, email verification, password reset)', async () => {
    // 1. Register a standard farmer
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Managed Farmer',
        email: 'managed@example.com',
        password: 'Password12345!',
      }),
    });
    const userToken = regRes.body.token;
    const userId = regRes.body.user._id || regRes.body.user.id;

    // 2. Admin suspends user
    const suspendRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ status: 'suspended', reason: 'Policy violation' }),
    });
    assert.equal(suspendRes.status, 200);
    assert.equal(suspendRes.body.user.status, 'suspended');

    // 3. Suspended user calling protected API is rejected
    const blockedCheck = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(blockedCheck.status, 403);
    assert.equal(blockedCheck.body.code, 'ACCOUNT_SUSPENDED');

    // 4. Admin reactivates user
    const reactivateRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ status: 'active', reason: 'Reinstated' }),
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.body.user.status, 'active');

    // 5. Admin can verify user email
    const verifyRes = await request(`/api/admin/users/${userId}/verify-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ reason: 'Admin verified via support ticket' }),
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.user.emailVerified, true);

    // 6. Admin can generate password reset token
    const resetRes = await request(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ reason: 'Customer requested reset' }),
    });
    assert.equal(resetRes.status, 200);
    assert.ok(resetRes.body.resetToken);
  });

  await t.test('10. User language preference persists and can be updated', async () => {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Language User',
        email: 'lang@example.com',
        password: 'Password12345!',
        language: 'hi',
      }),
    });
    assert.equal(regRes.body.user.language, 'hi');
    const token = regRes.body.token;

    // Update language to English
    const updateRes = await request('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language: 'en' }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.user.language, 'en');

    // Reject invalid language
    const badLangRes = await request('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language: 'fr' }),
    });
    assert.equal(badLangRes.status, 400);
  });

  await t.test('11. Portal enforcement: server enforces portal against user role', async () => {
    // 1. Root admin trying to log in via Farmer/User portal is rejected
    const adminAsFarmer = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
        portal: 'user',
      }),
    });
    assert.equal(adminAsFarmer.status, 403);
    assert.equal(adminAsFarmer.body.code, 'ADMIN_PORTAL_REQUIRED');

    // 2. Regular farmer trying to log in via Admin portal is rejected
    const farmerAsAdmin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'farmer@example.com',
        password: 'Password12345!',
        portal: 'admin',
      }),
    });
    assert.equal(farmerAsAdmin.status, 403);
    assert.equal(farmerAsAdmin.body.code, 'NOT_AN_ADMIN');

    // 3. Regular farmer logging in via Farmer/User portal succeeds
    const farmerAsFarmer = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'farmer@example.com',
        password: 'Password12345!',
        portal: 'user',
      }),
    });
    assert.equal(farmerAsFarmer.status, 200);
    assert.equal(farmerAsFarmer.body.user.role, 'farmer');
  });
});
