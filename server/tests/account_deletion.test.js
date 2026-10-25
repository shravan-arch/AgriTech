import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';
import { userStore } from '../src/storage/userStore.js';
import { farmStore } from '../src/storage/farmStore.js';
import { photoStorage, getUploadDir } from '../src/storage/photoStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDataDir = path.resolve(__dirname, '../data-test-account-deletion');
const testPhotoDir = path.resolve(__dirname, '../uploads-test-account-deletion');

process.env.NODE_ENV = 'development';
process.env.STORAGE_MODE = 'local-json';
process.env.LOCAL_DATA_DIR = testDataDir;
process.env.PHOTO_UPLOAD_DIR = testPhotoDir;
process.env.PHOTO_STORAGE_PROVIDER = 'local';
process.env.JWT_SECRET = 'a3236853bbdae24819ed03d65410aaadbf07e1b3130bc84e54e2ac299f934ebdc051315aca2f0a40f34bfa9f3eeb8458';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

const { connectDB } = await import('../src/config/db.js');
await connectDB();

const cleanStorage = () => {
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testPhotoDir)) {
    fs.rmSync(testPhotoDir, { recursive: true, force: true });
  }
};

let lastVerificationEmail = null;
const makeMockEmailService = () => ({
  sentEmails: [],
  sendVerificationEmail: async (params) => {
    lastVerificationEmail = params;
    return true;
  },
  sendPasswordResetEmail: async () => true,
});

test.before(() => {
  cleanStorage();
});

test.after(() => {
  cleanStorage();
});

test('Permanent Account Deletion Suite', async (t) => {
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
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { status: response.status, body, headers: response.headers };
    } finally {
      server.close();
    }
  };

  const registerAndVerify = async (name, email, password, role = 'user') => {
    lastVerificationEmail = null;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    assert.equal(regRes.status, 201);

    const token = lastVerificationEmail?.verificationToken;
    assert.ok(token, 'Verification token must have been sent');

    const verifyRes = await request('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    assert.equal(verifyRes.status, 200);

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, portal: role === 'admin' ? 'admin' : 'user' }),
    });
    assert.equal(loginRes.status, 200);
    return { user: loginRes.body.user, token: loginRes.body.token };
  };

  await t.test('1. Deletion requires explicit confirmation and password reauthentication', async () => {
    const { token } = await registerAndVerify('Delete Tester 1', 'deltest1@agritech.com', 'SecurePass1234!');

    // 1a. Missing confirmation
    const noConfirm = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'SecurePass1234!' }),
    });
    assert.equal(noConfirm.status, 400);
    assert.equal(noConfirm.body.code, 'CONFIRMATION_REQUIRED');

    // 1b. Missing password
    const noPass = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    });
    assert.equal(noPass.status, 401);
    assert.equal(noPass.body.code, 'PASSWORD_REQUIRED');

    // 1c. Incorrect password
    const wrongPass = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'WrongPassword999!', confirmation: 'DELETE' }),
    });
    assert.equal(wrongPass.status, 401);
    assert.equal(wrongPass.body.code, 'INVALID_CREDENTIALS');
  });

  await t.test('2. Complete cascading deletion of farmer account, farm records, and physical photo files', async () => {
    const { user, token } = await registerAndVerify('Farmer Delete', 'farmerdel@agritech.com', 'FarmerSecret123!');
    const userId = user.id || user._id;

    // Create a farm
    const farmRes = await request('/api/farms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Delete Farm Alpha',
        location: {
          country: 'India',
          region: 'Punjab',
          city: 'Ludhiana',
          latitude: 30.9,
          longitude: 75.85,
        },
      }),
    });
    assert.equal(farmRes.status, 201);
    const farmId = farmRes.body.farm._id || farmRes.body.farm.id;

    // Create a field
    const fieldRes = await request(`/api/farms/${farmId}/fields`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Wheat Field 1',
        areaHectares: 5.0,
        soilType: 'loam',
      }),
    });
    assert.equal(fieldRes.status, 201);
    const fieldId = fieldRes.body.field._id || fieldRes.body.field.id;

    // Create a task
    const taskRes = await request('/api/farms/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        farmId,
        fieldId,
        title: 'Apply Organic Fertilizer',
        type: 'fertilizer',
        priority: 'high',
        status: 'pending',
        dueDate: new Date().toISOString(),
      }),
    });
    assert.equal(taskRes.status, 201);

    // Create a photograph on disk
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const savedPhoto = await photoStorage.savePhoto({ buffer: fakeJpeg, ownerId: userId });
    assert.ok(savedPhoto.storageKey);

    // Save field photo record
    await farmStore.createPhoto(userId, {
      farmId,
      fieldId,
      storageKey: savedPhoto.storageKey,
      storageProvider: 'local',
      mimeType: 'image/jpeg',
      fileSize: fakeJpeg.length,
      originalFilename: 'test-plant.jpg',
    });

    // Verify photo exists on filesystem before deletion
    const photoOnDisk = await photoStorage.getPhoto({ storageKey: savedPhoto.storageKey });
    assert.ok(photoOnDisk, 'Photo should exist on disk before deletion');

    // Confirm data exists
    const farmsBefore = await farmStore.listFarms(userId);
    assert.equal(farmsBefore.length, 1);

    // Permanently delete the account
    const deleteRes = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        password: 'FarmerSecret123!',
        confirmation: 'DELETE',
      }),
    });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);

    // Verify user no longer exists in store
    const deletedUser = await userStore.findById(userId);
    assert.equal(deletedUser, null, 'User document must be completely deleted');

    // Verify farms and fields are gone
    const farmsAfter = await farmStore.listFarms(userId);
    assert.equal(farmsAfter.length, 0, 'Farms must be completely deleted');

    // Verify photo was deleted from disk
    const photoAfter = await photoStorage.getPhoto({ storageKey: savedPhoto.storageKey });
    assert.equal(photoAfter, null, 'Photo file on disk must be unlinked');
  });

  await t.test('3. Immediate session revocation: old tokens cannot access protected routes', async () => {
    const { token } = await registerAndVerify('Revoke Test', 'revoketest@agritech.com', 'PassRevoke123!');

    // Verify token works
    const meBefore = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meBefore.status, 200);

    // Delete account
    const delRes = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'PassRevoke123!', confirmation: 'DELETE' }),
    });
    assert.equal(delRes.status, 200);

    // Token must now be rejected
    const meAfter = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meAfter.status, 401);
  });

  await t.test('4. Repeated deletion requests fail safely (Idempotency)', async () => {
    const { token } = await registerAndVerify('Repeat Delete', 'repeatdel@agritech.com', 'RepeatPass123!');

    // First deletion succeeds
    const firstDel = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'RepeatPass123!', confirmation: 'DELETE' }),
    });
    assert.equal(firstDel.status, 200);

    // Second deletion with the same token is rejected as Unauthorized
    const secondDel = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'RepeatPass123!', confirmation: 'DELETE' }),
    });
    assert.equal(secondDel.status, 401);
  });

  await t.test('5. Last active Admin protection: Sole admin cannot delete their account', async () => {
    // Bootstrap root admin
    const bootRes = await request('/api/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.com',
        name: 'Root Administrator',
        password: 'RootAdminPass123!',
      }),
    });
    assert.ok(bootRes.status === 200 || bootRes.status === 403);

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.com',
        password: 'RootAdminPass123!',
        portal: 'admin',
      }),
    });
    assert.equal(loginRes.status, 200);
    const adminToken = loginRes.body.token;

    // Attempting to delete the sole active admin must fail with 403 LAST_ADMIN_PROTECTION
    const delRes = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        password: 'RootAdminPass123!',
        confirmation: 'DELETE',
      }),
    });
    assert.equal(delRes.status, 403);
    assert.equal(delRes.body.code, 'LAST_ADMIN_PROTECTION');
  });

  await t.test('6. Admin account deletion succeeds when another authorized admin exists', async () => {
    // Log in as root admin
    const rootLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rootadmin@agritech.com',
        password: 'RootAdminPass123!',
        portal: 'admin',
      }),
    });
    const rootToken = rootLogin.body.token;

    // Create and approve a second admin
    const secondAdminUser = await userStore.create({
      name: 'Second Admin',
      email: 'secondadmin@agritech.com',
      password: 'SecondAdminPass123!',
      role: 'admin',
      emailVerified: true,
      status: 'active',
    });
    assert.ok(secondAdminUser);

    // Log in as second admin
    const secondLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'secondadmin@agritech.com',
        password: 'SecondAdminPass123!',
        portal: 'admin',
      }),
    });
    assert.equal(secondLogin.status, 200);
    const secondToken = secondLogin.body.token;

    // Second admin can delete their account because root admin still exists
    const delRes = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secondToken}` },
      body: JSON.stringify({
        password: 'SecondAdminPass123!',
        confirmation: 'DELETE',
      }),
    });
    assert.equal(delRes.status, 200);

    // Second admin is gone
    const checkDeleted = await userStore.findById(secondAdminUser._id || secondAdminUser.id);
    assert.equal(checkDeleted, null);

    // Root admin remains active and functional
    const rootCheck = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    assert.equal(rootCheck.status, 200);
    assert.equal(rootCheck.body.user.role, 'admin');
  });

  await t.test('7. Re-registration using the same email succeeds as a completely fresh account', async () => {
    const email = 'reregister@agritech.com';
    const pass = 'OriginalPassword123!';

    // Register and delete
    const { token } = await registerAndVerify('Initial User', email, pass);
    const delRes = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: pass, confirmation: 'DELETE' }),
    });
    assert.equal(delRes.status, 200);

    // Re-register with the exact same email
    const reRegRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Brand New Identity',
        email,
        password: 'NewBrandPass987!',
        role: 'user',
      }),
    });
    assert.equal(reRegRes.status, 201, 'Re-registration should succeed with no unique index collision');
    assert.equal(reRegRes.body.user.name, 'Brand New Identity');
    assert.equal(reRegRes.body.user.emailVerified, false, 'Fresh registration requires email verification');

    // Unverified login should be blocked
    const unverifiedLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'NewBrandPass987!', portal: 'user' }),
    });
    assert.equal(unverifiedLogin.status, 403);
    assert.equal(unverifiedLogin.body.code, 'EMAIL_NOT_VERIFIED');

    // Verify email and verify normal login works
    const freshToken = lastVerificationEmail?.verificationToken;
    assert.ok(freshToken);
    await request('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: freshToken }),
    });

    const verifiedLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'NewBrandPass987!', portal: 'user' }),
    });
    assert.equal(verifiedLogin.status, 200);
    assert.equal(verifiedLogin.body.user.farmName, undefined, 'Old farm data must not be restored');
  });

  await t.test('8. Non-interference: Deleting User A does not affect User B records', async () => {
    const userA = await registerAndVerify('User Alpha', 'usera@agritech.com', 'PassAlpha123!');
    const userB = await registerAndVerify('User Beta', 'userb@agritech.com', 'PassBeta123!');

    // User B creates a farm
    const farmB = await request('/api/farms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({
        name: 'Beta Protected Farm',
        location: {
          country: 'India',
          region: 'Haryana',
          city: 'Karnal',
        },
      }),
    });
    assert.equal(farmB.status, 201);
    const farmBId = farmB.body.farm._id || farmB.body.farm.id;

    // User A deletes their account
    const delA = await request('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ password: 'PassAlpha123!', confirmation: 'DELETE' }),
    });
    assert.equal(delA.status, 200);

    // User B's account and farm remain untouched
    const userBMe = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert.equal(userBMe.status, 200);
    assert.equal(userBMe.body.user.email, 'userb@agritech.com');

    const farmsB = await farmStore.listFarms(userB.user.id || userB.user._id);
    assert.equal(farmsB.length, 1);
    assert.equal(farmsB[0].name, 'Beta Protected Farm');
  });
});
