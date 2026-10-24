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
const testDataDir = path.resolve(__dirname, '../data-test-admin-domains');

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

test('Enterprise Administrator 8-Domain Governance Suite', async (t) => {
  const app = createApp({ userStore, farmStore });

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
      return { status: response.status, body: data };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  };

  let adminToken;
  let farmerToken;

  await t.test('Setup: Bootstrap Admin and Register Regular Farmer', async () => {
    const bootstrapRes = await request('/api/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        email: 'governance.admin@agritech.org',
        name: 'Chief Platform Administrator',
        password: 'AdminPassword123!',
      }),
    });
    assert.equal(bootstrapRes.status, 200);

    const loginAdmin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'governance.admin@agritech.org',
        password: 'AdminPassword123!',
      }),
    });
    assert.equal(loginAdmin.status, 200);
    adminToken = loginAdmin.body.token;

    const regFarmer = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Farmer Baldev',
        email: 'baldev.singh@punjabagro.in',
        password: 'FarmerPassword123!',
        selectedRole: 'user',
      }),
    });
    assert.equal(regFarmer.status, 201);
    farmerToken = regFarmer.body.token;
  });

  // 1. User Management
  await t.test('Domain 1: User Management (Support Tickets & Inquiries)', async () => {
    const ticketsRes = await request('/api/admin/support-tickets', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(ticketsRes.status, 200);
    assert.ok(Array.isArray(ticketsRes.body.tickets));
    assert.ok(ticketsRes.body.tickets.length > 0);

    const firstTicketId = ticketsRes.body.tickets[0]._id || ticketsRes.body.tickets[0].id;
    const replyRes = await request(`/api/admin/support-tickets/${firstTicketId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        reply: 'We have updated your regional sensor telemetry calibration.',
        status: 'in_progress',
      }),
    });
    assert.equal(replyRes.status, 200);
    assert.equal(replyRes.body.ticket.adminReply, 'We have updated your regional sensor telemetry calibration.');
  });

  // 2. Content Management
  await t.test('Domain 2: Content Management (Crop Advisory & Products)', async () => {
    const createContentRes = await request('/api/admin/content', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Sharbati Wheat Precision Management',
        category: 'crop',
        cropType: 'Wheat',
        variety: 'C-306 Sharbati',
        sowingSeason: 'Rabi (Oct - Nov)',
        recommendedSoil: 'Well-drained Black Alluvial Loam',
        waterRequirement: '4-5 irrigations at crown root initiation',
        pestManagement: 'Treat seeds with Trichoderma viride',
        summary: 'Nutrient-rich premium golden grain with high protein and grain luster.',
        accuracyVerified: true,
        isPublished: true,
      }),
    });
    assert.equal(createContentRes.status, 201);
    const contentId = createContentRes.body.content._id || createContentRes.body.content.id;
    assert.ok(contentId);

    const listRes = await request('/api/admin/content', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.content.some((c) => c.title === 'Sharbati Wheat Precision Management'));

    const updateRes = await request(`/api/admin/content/${contentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ accuracyVerified: true, summary: 'Updated summary verified by senior agronomist.' }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.content.accuracyVerified, true);
  });

  // 3. Resource Management
  await t.test('Domain 3: Resource Management (Inventory & Supplier Coordination)', async () => {
    const listRes = await request('/api/admin/resources', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.resources));
    assert.ok(listRes.body.resources.length > 0);

    const targetResource = listRes.body.resources[0];
    const targetId = targetResource._id || targetResource.id;

    const restockRes = await request(`/api/admin/resources/${targetId}/reorder`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        quantity: 250,
        notes: 'Priority seasonal procurement for Rabi cycle',
      }),
    });
    assert.equal(restockRes.status, 200);
    assert.equal(restockRes.body.resource.supplierCoordinationStatus, 'reorder_placed');
  });

  // 4. Service Management
  await t.test('Domain 4: Service Management (Scheduling & Delivery)', async () => {
    const listServicesRes = await request('/api/admin/services', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listServicesRes.status, 200);
    assert.ok(Array.isArray(listServicesRes.body.bookings));
    assert.ok(listServicesRes.body.bookings.length > 0);

    const targetService = listServicesRes.body.bookings[0];
    const targetServiceId = targetService._id || targetService.id;

    const updateServiceRes = await request(`/api/admin/services/${targetServiceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'in_progress',
        dispatchNotes: 'Operator dispatched with DJI Agras T40 drone system.',
      }),
    });
    assert.equal(updateServiceRes.status, 200);
    assert.equal(updateServiceRes.body.booking.status, 'in_progress');
  });

  // 5. System Maintenance
  await t.test('Domain 5: System Maintenance (Checks, Health & Diagnostics)', async () => {
    const runCheckRes = await request('/api/admin/maintenance/run-check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(runCheckRes.status, 200);
    assert.equal(runCheckRes.body.diagnostics.status, 'healthy');

    const cacheRes = await request('/api/admin/maintenance/clear-cache', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(cacheRes.status, 200);
    assert.ok(cacheRes.body.message.includes('flushed'));
  });

  // 6. Security Management
  await t.test('Domain 6: Security Management (Threats, IP Blocklist & Policies)', async () => {
    const overviewRes = await request('/api/admin/security/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(overviewRes.status, 200);
    assert.ok(overviewRes.body.security);

    const blockRes = await request('/api/admin/security/block-ip', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ip: '203.0.113.42' }),
    });
    assert.equal(blockRes.status, 200);
    assert.ok(blockRes.body.blockedIPs.includes('203.0.113.42'));

    const unblockRes = await request('/api/admin/security/block-ip', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ip: '203.0.113.42', unblock: true }),
    });
    assert.equal(unblockRes.status, 200);
    assert.ok(!unblockRes.body.blockedIPs.includes('203.0.113.42'));
  });

  // 7. Data Analytics
  await t.test('Domain 7: Data Analytics (User Behavior & Strategic Planning)', async () => {
    const analyticsRes = await request('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(analyticsRes.status, 200);
    assert.ok(analyticsRes.body.analytics.userEngagement);
    assert.ok(analyticsRes.body.analytics.cropDemandInsights);

    const reportRes = await request('/api/admin/analytics/generate-report', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reportType: 'quarterly_strategic_growth' }),
    });
    assert.equal(reportRes.status, 200);
    assert.ok(reportRes.body.report.sections.length > 0);
  });

  // 8. Policy Enforcement
  await t.test('Domain 8: Policy Enforcement (Compliance & Violation Tracking)', async () => {
    const recordViolationRes = await request('/api/admin/policies/violations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        userName: 'Unauthorized Drone Operator',
        userEmail: 'unauthorized@badactor.net',
        violationType: 'unauthorized_commercial_solicitation',
        severity: 'high',
        description: 'Attempting to solicit commercial bookings outside escrow policy.',
        actionTaken: 'temporary_suspension',
      }),
    });
    assert.equal(recordViolationRes.status, 201);
    const violationId = recordViolationRes.body.violation._id || recordViolationRes.body.violation.id;

    const listViolations = await request('/api/admin/policies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listViolations.status, 200);
    assert.ok(listViolations.body.violations.some((v) => v.userEmail === 'unauthorized@badactor.net'));

    const resolveRes = await request(`/api/admin/policies/violations/${violationId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ notes: 'Signed updated compliance policy agreement.' }),
    });
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveRes.body.violation.status, 'resolved');
  });

  // Strict Role Isolation: Farmer cannot access any domain endpoint
  await t.test('Strict Isolation: Non-admin users are rejected with 403 on all admin domains', async () => {
    const endpoints = [
      '/api/admin/users',
      '/api/admin/support-tickets',
      '/api/admin/content',
      '/api/admin/resources',
      '/api/admin/services',
      '/api/admin/maintenance/run-check',
      '/api/admin/security/overview',
      '/api/admin/analytics',
      '/api/admin/policies',
    ];

    for (const ep of endpoints) {
      const res = await request(ep, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      });
      assert.equal(res.status, 403, `Farmer should be blocked with 403 from ${ep}`);
    }
  });

  // Dedicated Admin Self-Profile Management & Protection
  await t.test('Admin Self-Profile: View profile, update permitted details, block role tampering, and change password', async () => {
    // 1. Get Profile
    const profileRes = await request('/api/admin/my-profile', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.profile.email, 'governance.admin@agritech.org');
    assert.equal(profileRes.body.profile.role, 'admin');

    // 2. Update Permitted Personal Details
    const updateRes = await request('/api/admin/my-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        phone: '+91 98765 43210',
        language: 'hi',
        address: 'HQ Administrative Block, AgriTech Complex',
        profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.profile.phone, '+91 98765 43210');
    assert.equal(updateRes.body.profile.language, 'hi');
    assert.equal(updateRes.body.profile.address, 'HQ Administrative Block, AgriTech Complex');

    // 3. Block Self-Role or Status Tampering
    const tamperRes = await request('/api/admin/my-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'superadmin' }),
    });
    assert.equal(tamperRes.status, 403);
    assert.equal(tamperRes.body.code, 'SELF_PRIVILEGE_ESCALATION_BLOCKED');

    // 4. Change Password via Secure Flow
    const changePassRes = await request('/api/admin/my-profile/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        currentPassword: 'AdminPassword123!',
        newPassword: 'BrandNewAdminSecure#2026',
      }),
    });
    assert.equal(changePassRes.status, 200);
    assert.equal(changePassRes.body.success, true);

    // 5. Farmer cannot access admin my-profile
    const farmerSelfRes = await request('/api/admin/my-profile', {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    assert.equal(farmerSelfRes.status, 403);
  });
});
