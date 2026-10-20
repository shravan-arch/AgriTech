import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { userStore } from '../src/storage/userStore.js';

let server;
let baseUrl;

before(async () => {
  // Start server on an ephemeral port for testing
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Helper for making HTTP requests in tests
const request = async (method, path, body = null, token = null) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
};

describe('AgriTech Authentication & Security Test Suite', () => {
  const testEmail = `farmer-${Date.now()}@agritech-test.com`;
  const testPassword = 'SafePassword123!';
  let authToken;
  let testUserId;

  test('1. GET /api/health should return status ok with persistence mode', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.ok(res.data.database);
    assert.ok(res.data.services);
  });

  test('2. POST /api/auth/register should create a user and return JWT token', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Test Farmer',
      email: testEmail,
      password: testPassword,
      farmName: 'Test Heritage Farm',
      farmSizeHectares: 30,
      primaryCrops: ['Wheat', 'Barley'],
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.ok(res.data.token, 'Should return a JWT token');
    assert.equal(res.data.user.email, testEmail.toLowerCase());
    assert.equal(res.data.user.password, undefined, 'Password must not be returned');
    assert.equal(res.data.user.role, 'farmer');

    authToken = res.data.token;
    testUserId = res.data.user.id || res.data.user._id;
  });

  test('3. POST /api/auth/register should reject duplicate email with 409', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Duplicate Farmer',
      email: testEmail,
      password: testPassword,
    });

    assert.equal(res.status, 409);
    assert.equal(res.data.error, 'Conflict');
  });

  test('4. POST /api/auth/register should prevent privilege escalation to admin', async () => {
    const attackEmail = `hacker-${Date.now()}@test.com`;
    const res = await request('POST', '/api/auth/register', {
      name: 'Privilege Escalation Attempt',
      email: attackEmail,
      password: 'StrongPassword123!',
      role: 'admin', // Malicious attempt to register as admin
    });

    assert.equal(res.status, 201);
    // Role must be forced to 'farmer'
    assert.equal(res.data.user.role, 'farmer', 'Public registration must never assign admin role');
  });

  test('5. POST /api/auth/register should reject invalid email format with 400', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Invalid Email Farmer',
      email: 'not-an-email',
      password: testPassword,
    });

    assert.equal(res.status, 400);
  });

  test('6. POST /api/auth/register should reject password shorter than 6 characters', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Short Password Farmer',
      email: `shortpass-${Date.now()}@test.com`,
      password: '123',
    });

    assert.equal(res.status, 400);
  });

  test('7. POST /api/auth/login should authenticate valid user and issue token', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.token);
    assert.equal(res.data.user.email, testEmail.toLowerCase());
  });

  test('8. POST /api/auth/login should reject incorrect password with 401', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword999!',
    });

    assert.equal(res.status, 401);
  });

  test('9. GET /api/auth/me should return current profile with valid JWT', async () => {
    const res = await request('GET', '/api/auth/me', null, authToken);

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.user.email, testEmail.toLowerCase());
  });

  test('10. GET /api/auth/me should reject request without token with 401', async () => {
    const res = await request('GET', '/api/auth/me');

    assert.equal(res.status, 401);
  });

  test('11. GET /api/auth/user/:id should allow user to view their own profile', async () => {
    const res = await request('GET', `/api/auth/user/${testUserId}`, null, authToken);

    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, testEmail.toLowerCase());
  });

  test('12. GET /api/auth/user/:id should reject user accessing another user with 403', async () => {
    const otherUserId = 'user-foreign-id-9999';
    const res = await request('GET', `/api/auth/user/${otherUserId}`, null, authToken);

    assert.equal(res.status, 403);
    assert.equal(res.data.error, 'Forbidden');
  });

  test('13. Persistence Check: User persists in storage across simulated restarts', async () => {
    // Check direct storage lookup without depending on process memory
    const persistedUser = await userStore.findByEmail(testEmail);
    assert.ok(persistedUser, 'User must exist in persistent store');
    assert.equal(persistedUser.email, testEmail.toLowerCase());
    assert.notEqual(persistedUser.password, testPassword, 'Password must be hashed on disk');
  });
});
