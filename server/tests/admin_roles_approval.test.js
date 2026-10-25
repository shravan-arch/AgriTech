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

test('Role Selection, Admin Approval, Role Management, and Access Control Suite', async (t) => {
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

  await t.test('1. Registration with User role creates a standard farmer account', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Normal Farmer',
        email: 'farmer@example.com',
        password: 'Password12345!',
        selectedRole: 'user',
        language: 'hi',
      }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'farmer');
    assert.equal(res.body.user.language, 'hi');
    assert.equal(res.body.requiresAdminApproval, false);
    assert.equal(res.body.user.roleRequest.status, 'none');
    assert.ok(res.body.token);
  });

  await t.test('2. Registration requesting Admin role sets role to farmer and roleRequest to pending', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Applicant Admin',
        email: 'applicant@example.com',
        password: 'Password12345!',
        selectedRole: 'admin',
        language: 'en',
      }),
    });

    assert.equal(res.status, 201);
    // CRITICAL: NEVER immediately grant admin role!
    assert.equal(res.body.user.role, 'farmer');
    assert.equal(res.body.requiresAdminApproval, true);
    assert.equal(res.body.user.roleRequest.status, 'pending');
    assert.equal(res.body.user.roleRequest.requestedRole, 'admin');
    assert.match(res.body.message, /pending administrator approval/i);

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

    const res = await request('/api/admin/pending-requests', {
      headers: { Authorization: `Bearer ${reg.body.token}` },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /not permitted/i);
  });

  await t.test('4. First admin bootstrap establishes root admin and disables subsequent bootstrap', async () => {
    // 0 admins exist initially
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

  await t.test('5. Admin can list pending requests, approve applicant, and audit log is recorded', async () => {
    // 1. Log in as root admin
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });
    const adminToken = loginRes.body.token;

    // 2. Register an applicant requesting admin
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Future Admin',
        email: 'future@agritech.farm',
        password: 'FuturePassword123!',
        selectedRole: 'admin',
      }),
    });
    const applicantId = regRes.body.user._id || regRes.body.user.id;

    // 3. Admin lists pending requests
    const pendingList = await request('/api/admin/pending-requests', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(pendingList.status, 200);
    assert.ok(pendingList.body.requests.some((u) => u.email === 'future@agritech.farm'));

    // 4. Admin approves applicant
    const approveRes = await request(`/api/admin/requests/${applicantId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Approved qualified agricultural director' }),
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.user.role, 'admin');
    assert.equal(approveRes.body.user.roleRequest.status, 'approved');

    // 5. Newly approved admin logs in with fresh credentials and accesses admin endpoints
    const loginApproved = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'future@agritech.farm',
        password: 'FuturePassword123!',
        portal: 'admin',
      }),
    });
    assert.equal(loginApproved.status, 200);
    const newAdminToken = loginApproved.body.token;
    const accessCheck = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${newAdminToken}` },
    });
    assert.equal(accessCheck.status, 200);

    // 6. Check audit log
    const auditRes = await request('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(auditRes.status, 200);
    const approvedLog = auditRes.body.logs.find(
      (log) => log.action === 'ROLE_REQUEST_APPROVED' && log.targetUserEmail === 'future@agritech.farm'
    );
    assert.ok(approvedLog);
    assert.equal(approvedLog.newRole, 'admin');
    assert.match(approvedLog.reason, /qualified agricultural director/i);
  });

  await t.test('6. Admin can reject a role request, leaving user as standard farmer', async () => {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });
    const adminToken = loginRes.body.token;

    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rejected Applicant',
        email: 'rejected@agritech.farm',
        password: 'Password12345!',
        selectedRole: 'admin',
      }),
    });
    const targetId = regRes.body.user._id || regRes.body.user.id;

    const rejectRes = await request(`/api/admin/requests/${targetId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Insufficient credentials for admin role' }),
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.user.role, 'farmer');
    assert.equal(rejectRes.body.user.roleRequest.status, 'rejected');

    // Verify still cannot access admin
    const check = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${regRes.body.token}` },
    });
    assert.equal(check.status, 403);
  });

  await t.test('7. Admins cannot approve their own requests or modify their own role', async () => {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });
    const adminToken = loginRes.body.token;
    const adminId = loginRes.body.user._id || loginRes.body.user.id;

    // Self-approval
    const selfApprove = await request(`/api/admin/requests/${adminId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(selfApprove.status, 403);

    // Self-role-change
    const selfRoleChange = await request(`/api/admin/users/${adminId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'farmer' }),
    });
    assert.equal(selfRoleChange.status, 403);

    // Self-suspension
    const selfSuspend = await request(`/api/admin/users/${adminId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(selfSuspend.status, 403);
  });

  await t.test('8. Last active Admin protection: cannot demote or suspend the sole remaining admin', async () => {
    // Current active admins: 'rootadmin@agritech.farm' and 'future@agritech.farm' (2 admins)
    const loginRoot = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });
    const rootToken = loginRoot.body.token;

    const loginFuture = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'future@agritech.farm',
        password: 'FuturePassword123!',
      }),
    });
    const futureId = loginFuture.body.user._id || loginFuture.body.user.id;

    // Demoting 'future' succeeds because 'rootadmin' is still an active admin
    const demoteRes = await request(`/api/admin/users/${futureId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootToken}` },
      body: JSON.stringify({ role: 'farmer', reason: 'Stepping down to farmer' }),
    });
    assert.equal(demoteRes.status, 200);
    assert.equal(demoteRes.body.user.role, 'farmer');

    // Now ONLY 'rootadmin' is active admin.
    // If future tries to demote rootadmin (or if another admin existed and tried), it must be blocked:
    // Let's create a temporary admin to test demoting the last admin:
    // Let's re-promote future:
    await request(`/api/admin/users/${futureId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootToken}` },
      body: JSON.stringify({ role: 'admin' }),
    });
    // Now suspend rootadmin from future (getting fresh token after role change):
    const refreshedFutureLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'future@agritech.farm',
        password: 'FuturePassword123!',
        portal: 'admin',
      }),
    });
    const futureToken = refreshedFutureLogin.body.token;
    const rootId = loginRoot.body.user._id || loginRoot.body.user.id;

    // Future can suspend rootadmin because future is also active admin:
    const suspendRoot = await request(`/api/admin/users/${rootId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${futureToken}` },
      body: JSON.stringify({ status: 'suspended', reason: 'Temporary suspension' }),
    });
    assert.equal(suspendRoot.status, 200);

    // Now 'future' is the ONLY active admin left.
    // If anyone tries to demote or suspend 'future', it MUST be rejected by LAST_ADMIN_PROTECTION!
    const demoteLast = await request(`/api/admin/users/${futureId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${futureToken}` }, // self-check triggers first, but let's test via userStore directly
    });
    assert.equal(demoteLast.status, 403); // self-protection triggers

    // Test last admin protection via store
    await assert.rejects(
      async () => {
        await userStore.updateUserRole({
          targetUserId: futureId,
          newRole: 'farmer',
          actor: { id: 'other', email: 'other@test.com', name: 'Other' },
        });
      },
      (err) => err.code === 'LAST_ADMIN_PROTECTION'
    );

    await assert.rejects(
      async () => {
        await userStore.updateUserStatus({
          targetUserId: futureId,
          status: 'suspended',
          actor: { id: 'other', email: 'other@test.com', name: 'Other' },
        });
      },
      (err) => err.code === 'LAST_ADMIN_PROTECTION'
    );

    // Reactivate rootadmin
    await userStore.updateUserStatus({
      targetUserId: rootId,
      status: 'active',
      actor: { id: futureId, email: 'future@agritech.farm', name: 'Future Admin' },
    });
  });

  await t.test('9. Suspended account loses access to protected operations and login', async () => {
    const loginRoot = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
      }),
    });
    const rootToken = loginRoot.body.token;

    // Register a standard farmer
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Actor',
        email: 'badactor@example.com',
        password: 'Password12345!',
      }),
    });
    const userToken = regRes.body.token;
    const userId = regRes.body.user._id || regRes.body.user.id;

    // Verify user can access profile
    const okCheck = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(okCheck.status, 200);

    // Admin suspends user
    const suspendRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootToken}` },
      body: JSON.stringify({ status: 'suspended', reason: 'Terms of service violation' }),
    });
    assert.equal(suspendRes.status, 200);
    assert.equal(suspendRes.body.user.status, 'suspended');

    // Suspended user calling protected API is immediately rejected with 403 ACCOUNT_SUSPENDED
    const blockedCheck = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(blockedCheck.status, 403);
    assert.equal(blockedCheck.body.code, 'ACCOUNT_SUSPENDED');

    // Suspended user attempting password login is rejected with 403 ACCOUNT_SUSPENDED
    const loginBlocked = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'badactor@example.com',
        password: 'Password12345!',
      }),
    });
    assert.equal(loginBlocked.status, 403);
    assert.equal(loginBlocked.body.code, 'ACCOUNT_SUSPENDED');

    // Admin reactivates user
    const reactivateRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootToken}` },
      body: JSON.stringify({ status: 'active', reason: 'Appeal accepted' }),
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.body.user.status, 'active');

    // User can now log in and access protected operations again
    const loginOk = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'badactor@example.com',
        password: 'Password12345!',
      }),
    });
    assert.equal(loginOk.status, 200);
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

  await t.test('11. Separate login options: server enforces selected portal role against user role and approval', async () => {
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

    // 3. Pending admin applicant trying to log in via Admin portal is rejected with pending approval
    const pendingAsAdmin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'applicant@example.com',
        password: 'Password12345!',
        portal: 'admin',
      }),
    });
    assert.equal(pendingAsAdmin.status, 403);
    assert.equal(pendingAsAdmin.body.code, 'ADMIN_PENDING_APPROVAL');

    // 4. Pending applicant CAN log in via Farmer/User portal
    const pendingAsFarmer = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'applicant@example.com',
        password: 'Password12345!',
        portal: 'user',
      }),
    });
    assert.equal(pendingAsFarmer.status, 200);
    assert.equal(pendingAsFarmer.body.user.role, 'farmer');
  });

  await t.test('12. Session revocation and data safety on role change to admin', async () => {
    // Register farmer with farm details
    const farmerReg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Promotable Farmer',
        email: 'promotable@example.com',
        password: 'Password12345!',
        selectedRole: 'user',
        farmName: 'Sunset Valley',
        farmSizeHectares: 25,
      }),
    });
    const farmerToken = farmerReg.body.token;
    const farmerId = farmerReg.body.user._id || farmerReg.body.user.id;

    // Login root admin to promote farmer
    const rootLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.farm',
        password: 'RootAdminPassword123!',
        portal: 'admin',
      }),
    });
    const rootToken = rootLogin.body.token;

    // Promote farmer to admin
    const promoteRes = await request(`/api/admin/users/${farmerId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rootToken}` },
      body: JSON.stringify({ role: 'admin', reason: 'Promoted to admin team' }),
    });
    assert.equal(promoteRes.status, 200);
    assert.equal(promoteRes.body.user.role, 'admin');

    // Old farmer token must now be REVOKED with 401
    const oldTokenCheck = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(oldTokenCheck.status, 401);
    assert.equal(oldTokenCheck.body.code, 'TOKEN_REVOKED');

    // Promoted account can now log in via Admin portal
    const newAdminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'promotable@example.com',
        password: 'Password12345!',
        portal: 'admin',
      }),
    });
    assert.equal(newAdminLogin.status, 200);
    assert.equal(newAdminLogin.body.user.role, 'admin');
    // Personal farmer profile data transition
    assert.equal(newAdminLogin.body.user.farmName, '');
  });
});
