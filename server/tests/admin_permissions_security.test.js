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
const testDataDir = path.resolve(__dirname, '../data-test-admin-security');

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

test.before(() => cleanStorage());
test.after(() => cleanStorage());

test('Admin Role, Permissions, and Access Control Security Suite', async (t) => {
  const app = createApp({
    userStore,
    farmStore,
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
  let secondAdminToken;
  let secondAdminId;
  let farmerToken;
  let farmerId;

  await t.test('1. Setup initial root administrator via bootstrap', async () => {
    const bootstrapRes = await request('/api/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.org',
        name: 'Root Administrator',
        password: 'AdminPassword123!',
      }),
    });

    assert.equal(bootstrapRes.status, 200);
    assert.equal(bootstrapRes.body.user.role, 'admin');

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.org',
        password: 'AdminPassword123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    rootAdminToken = loginRes.body.token;
    rootAdminId = loginRes.body.user._id || loginRes.body.user.id;
  });

  await t.test('2. Public registration never grants admin role directly', async () => {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sneaky Applicant',
        email: 'sneaky@example.org',
        password: 'Password12345!',
        selectedRole: 'admin',
      }),
    });

    assert.equal(regRes.status, 201);
    assert.equal(regRes.body.user.role, 'farmer');
    assert.equal(regRes.body.requiresAdminApproval, undefined);
    assert.equal(regRes.body.user.roleRequest, undefined);
    farmerToken = regRes.body.token;
    farmerId = regRes.body.user._id || regRes.body.user.id;
  });

  await t.test('3. Non-admin users cannot access administrative endpoints (Role Escalation Prevention)', async () => {
    const blockedRes = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(blockedRes.status, 403);

    const blockedSettings = await request('/api/admin/settings', {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(blockedSettings.status, 403);
  });

  await t.test('4. Role promotion endpoint is removed and returns 404', async () => {
    const promoteRes = await request(`/api/admin/users/${farmerId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ role: 'admin', reason: 'Promoted to co-administrator' }),
    });
    assert.equal(promoteRes.status, 404);

    // Create a fixture second admin directly in store for multi-admin governance tests
    const secondAdminUser = await userStore.create({
      name: 'Co-Administrator',
      email: 'coadmin@agritech.org',
      password: 'Password12345!',
      role: 'admin',
      status: 'active',
      emailVerified: true,
    });
    secondAdminId = secondAdminUser._id || secondAdminUser.id;

    const loginSecond = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'coadmin@agritech.org',
        password: 'Password12345!',
        portal: 'admin',
      }),
    });
    assert.equal(loginSecond.status, 200);
    secondAdminToken = loginSecond.body.token;
  });

  await t.test('5. Strict Restriction: Administrators cannot create personal agricultural resources', async () => {
    // Admin cannot create farm
    const createFarmRes = await request('/api/farms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({
        name: 'Admin Personal Farm',
        location: { city: 'Ludhiana', region: 'Punjab' },
      }),
    });
    assert.equal(createFarmRes.status, 403);
    assert.equal(createFarmRes.body.code, 'ADMIN_WRITE_RESTRICTED');

    // Admin cannot create inventory
    const createInvRes = await request('/api/inventory', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({
        farmId: '600000000000000000000001',
        name: 'Admin Urea',
        category: 'fertilizer',
        unit: 'kg',
      }),
    });
    assert.equal(createInvRes.status, 403);
    assert.equal(createInvRes.body.code, 'ADMIN_WRITE_RESTRICTED');

    // Admin cannot create financial record
    const createFinanceRes = await request('/api/finances', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({
        farmId: '600000000000000000000001',
        type: 'expense',
        category: 'seeds',
        amount: 5000,
      }),
    });
    assert.equal(createFinanceRes.status, 403);
    assert.equal(createFinanceRes.body.code, 'ADMIN_WRITE_RESTRICTED');
  });

  await t.test('6. Strict Restriction: Admin cannot modify their own profile; changes must be done by another admin', async () => {
    // Root admin attempting to modify own profile via PUT /api/auth/profile is blocked
    const selfModRes = await request('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ name: 'Hacked Root Admin Name' }),
    });
    assert.equal(selfModRes.status, 403);
    assert.equal(selfModRes.body.code, 'ADMIN_SELF_MODIFICATION_RESTRICTED');

    // Root admin attempting to update self via admin endpoint is blocked
    const selfAdminModRes = await request(`/api/admin/users/${rootAdminId}/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ name: 'Hacked Root Name' }),
    });
    assert.equal(selfAdminModRes.status, 403);

    // Another administrator CAN update root admin's profile
    const peerModRes = await request(`/api/admin/users/${rootAdminId}/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${secondAdminToken}` },
      body: JSON.stringify({ phone: '+919876543210', address: '123 Agri Head Office' }),
    });
    assert.equal(peerModRes.status, 200);
    assert.equal(peerModRes.body.user.phone, '+919876543210');
  });

  await t.test('7. User Management Assistance: Admin can verify email and generate password reset for user', async () => {
    // Register unverified farmer
    const regFarmer = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Assisted Farmer',
        email: 'assisted@agritech.org',
        password: 'Password12345!',
        selectedRole: 'user',
      }),
    });
    const assistedId = regFarmer.body.user._id || regFarmer.body.user.id;
    assert.equal(regFarmer.body.user.emailVerified, false);

    // Admin verifies email
    const verifyRes = await request(`/api/admin/users/${assistedId}/verify-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ reason: 'Farmer requested verification via support' }),
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.user.emailVerified, true);

    // Admin generates password reset link without seeing password
    const resetRes = await request(`/api/admin/users/${assistedId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ reason: 'Forgotten credentials support ticket' }),
    });
    assert.equal(resetRes.status, 200);
    assert.ok(resetRes.body.resetToken);
  });

  await t.test('8. Platform Administration: Settings, Announcements, and System Health', async () => {
    // Get and update platform settings
    const settingsGet = await request('/api/admin/settings', {
      headers: { Authorization: `Bearer ${rootAdminToken}` },
    });
    assert.equal(settingsGet.status, 200);
    assert.ok(Array.isArray(settingsGet.body.settings.supportedLanguages));

    const settingsUpdate = await request('/api/admin/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({
        systemNotice: 'Scheduled maintenance this Sunday at 02:00 AM UTC',
        maintenanceMode: false,
      }),
    });
    assert.equal(settingsUpdate.status, 200);
    assert.equal(settingsUpdate.body.settings.systemNotice, 'Scheduled maintenance this Sunday at 02:00 AM UTC');

    // Broadcast system announcement
    const announceRes = await request('/api/admin/announcements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({
        title: 'New Advisory Models Live',
        message: 'Real-time soil moisture and pest warning models are now enabled.',
        severity: 'info',
      }),
    });
    assert.equal(announceRes.status, 200);
    assert.ok(announceRes.body.announcement.count > 0);

    // System health monitoring
    const healthRes = await request('/api/admin/system-health', {
      headers: { Authorization: `Bearer ${rootAdminToken}` },
    });
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.health.status, 'healthy');
    assert.ok(healthRes.body.health.activeAdmins >= 2);
  });

  await t.test('9. Authentication Failure Tracking in Security Audit Log', async () => {
    // Attempt invalid password login
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.org',
        password: 'WrongPassword!',
      }),
    });
    assert.equal(badLogin.status, 401);

    // Check audit logs contain AUTH_FAILURE
    const auditRes = await request('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${rootAdminToken}` },
    });
    assert.equal(auditRes.status, 200);
    const authFailures = auditRes.body.logs.filter((log) => log.action === 'AUTH_FAILURE');
    assert.ok(authFailures.length > 0);
  });

  await t.test('10. Last Active Admin Protection', async () => {
    // Suspend second admin
    const suspendSecond = await request(`/api/admin/users/${secondAdminId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ status: 'suspended', reason: 'Assignment completed' }),
    });
    assert.equal(suspendSecond.status, 200);

    // Now root admin is the ONLY active admin. Attempting to suspend root admin must be blocked
    const suspendLast = await request(`/api/admin/users/${rootAdminId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootAdminToken}` },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(suspendLast.status, 403); // self-protection

    // Test store-level last admin protection on status suspension
    await assert.rejects(
      async () => {
        await userStore.updateUserStatus({
          targetUserId: rootAdminId,
          status: 'suspended',
          actor: { id: 'external', email: 'external@test.org', name: 'External' },
        });
      },
      (err) => err.code === 'LAST_ADMIN_PROTECTION'
    );
  });
});
