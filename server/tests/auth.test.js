import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const { createApp } = await import('../src/app.js');
const { validateProductionEnv } = await import('../src/config/env.js');

const asJson = (record) => ({
  ...record,
  toJSON() {
    const { password, ...safe } = this;
    return safe;
  },
});

const createMemoryStores = () => {
  const users = new Map();
  const farms = new Map();
  const fields = new Map();
  let nextId = 1;
  const id = () => (nextId++).toString(16).padStart(24, '0');

  const userStore = {
    async create(values) {
      if (users.has(values.email)) {
        const error = new Error('Duplicate test email.');
        error.code = 11000;
        throw error;
      }
      const user = asJson({
        ...values,
        _id: id(),
        id: null,
        async comparePassword(password) {
          return bcrypt.compare(password, this.password);
        },
      });
      user.id = user._id;
      user.password = await bcrypt.hash(values.password, 4);
      users.set(user.email, user);
      return user;
    },
    async findByEmail(email) {
      return users.get(email) || null;
    },
    async findById(userId) {
      return [...users.values()].find((user) => user._id === userId) || null;
    },
    async findOwnedById(targetId, requesterId, isAdmin) {
      const user = await this.findById(targetId);
      return user && (isAdmin || targetId === requesterId) ? user : null;
    },
    verifyPassword(user, password) {
      return user.comparePassword(password);
    },
  };

  const farmStore = {
    async listFarms(ownerId) {
      return [...farms.values()].filter((farm) => farm.ownerId === String(ownerId));
    },
    async createFarm(ownerId, values) {
      const farm = { ...values, _id: id(), ownerId: String(ownerId) };
      farms.set(farm._id, farm);
      return farm;
    },
    async findFarm(ownerId, farmId) {
      const farm = farms.get(farmId);
      return farm?.ownerId === String(ownerId) ? farm : null;
    },
    async updateFarm(ownerId, farmId, values) {
      const farm = await this.findFarm(ownerId, farmId);
      if (!farm) return null;
      Object.assign(farm, values);
      return farm;
    },
    async deleteFarm(ownerId, farmId) {
      const farm = await this.findFarm(ownerId, farmId);
      if (!farm) return { deleted: false, hasFields: false };
      if ([...fields.values()].some((field) => field.farmId === farmId)) {
        return { deleted: false, hasFields: true };
      }
      farms.delete(farmId);
      return { deleted: true, hasFields: false };
    },
    async listFields(ownerId, farmId) {
      return [...fields.values()].filter(
        (field) => field.ownerId === String(ownerId) && field.farmId === farmId
      );
    },
    async createField(ownerId, farmId, values) {
      const field = { ...values, _id: id(), farmId, ownerId: String(ownerId) };
      fields.set(field._id, field);
      return field;
    },
    async updateField(ownerId, fieldId, values) {
      const field = fields.get(fieldId);
      if (!field || field.ownerId !== String(ownerId)) return null;
      Object.assign(field, values);
      return field;
    },
    async deleteField(ownerId, fieldId) {
      const field = fields.get(fieldId);
      if (!field || field.ownerId !== String(ownerId)) return null;
      fields.delete(fieldId);
      return field;
    },
  };

  return { userStore, farmStore };
};

let server;
let baseUrl;
let stores;
let userToken;
let otherToken;
let userId;
let farmId;
let fieldId;
let otherFarmId;
let otherFieldId;

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

before(async () => {
  stores = createMemoryStores();
  const app = createApp(stores);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('Production configuration', () => {
  test('requires the database, JWT secret, and client origin in production', () => {
    assert.throws(
      () => validateProductionEnv({ NODE_ENV: 'production' }),
      /MONGODB_URI, JWT_SECRET, CLIENT_URL/
    );
  });

  test('rejects a short or template JWT secret in production', () => {
    assert.throws(() => validateProductionEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/agritech',
      JWT_SECRET: 'your-development-secret',
      CLIENT_URL: 'https://app.example.com',
    }), /JWT_SECRET/);
  });

  test('rejects local JSON mode in production', () => {
    assert.throws(() => validateProductionEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/agritech',
      JWT_SECRET: 'a-private-production-secret-with-more-than-32-characters',
      CLIENT_URL: 'https://app.example.com',
      STORAGE_MODE: 'local-json',
    }), /only available in development/);
  });

  test('accepts configured production values without revealing them', () => {
    assert.doesNotThrow(() => validateProductionEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/agritech',
      JWT_SECRET: 'a-private-production-secret-with-more-than-32-characters',
      CLIENT_URL: 'https://app.example.com',
    }));
  });

  test('requires a signing key before non-test startup', async () => {
    const { validateRuntimeEnv } = await import('../src/config/env.js');
    assert.throws(() => validateRuntimeEnv({
      NODE_ENV: 'development',
      JWT_SECRET: '',
    }), /JWT_SECRET/);
  });

  test('refuses to start persistence without MongoDB instead of selecting a local store', async () => {
    const { connectDB, getDBStatus } = await import('../src/config/db.js');
    const configuredUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = '';
    try {
      await assert.rejects(connectDB(), /no local persistence fallback/);
      assert.equal(getDBStatus().mode, 'unavailable');
    } finally {
      if (configuredUri === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = configuredUri;
    }
  });
});

describe('Authentication and owner-scoped farm management', () => {
  test('reports database unavailability without exposing diagnostics', async () => {
    const response = await request('GET', '/api/health');
    assert.equal(response.status, 503);
    assert.equal(response.data.status, 'unavailable');
    assert.equal(response.data.database, undefined);
  });

  test('registers a farmer, hashes the password, and ignores attempted role elevation', async () => {
    const response = await request('POST', '/api/auth/register', {
      name: 'Test Farmer',
      email: 'farmer@example.test',
      password: 'SafePassword123!',
      role: 'admin',
    });
    assert.equal(response.status, 201);
    assert.equal(response.data.user.role, 'farmer');
    assert.equal(response.data.user.password, undefined);
    assert.notEqual(
      (await stores.userStore.findByEmail('farmer@example.test')).password,
      'SafePassword123!'
    );
    userToken = response.data.token;
    userId = response.data.user.id || response.data.user._id;
  });

  test('rejects duplicate registration and invalid fields', async () => {
    const duplicate = await request('POST', '/api/auth/register', {
      name: 'Duplicate',
      email: 'farmer@example.test',
      password: 'SafePassword123!',
    });
    const invalid = await request('POST', '/api/auth/register', {
      name: 'Bad email',
      email: 'not-an-email',
      password: 'short',
    });
    const unknown = await request('POST', '/api/auth/register', {
      name: 'Unknown property',
      email: 'other@example.test',
      password: 'SafePassword123!',
      isAdmin: true,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(invalid.status, 400);
    assert.equal(unknown.status, 400);
  });

  test('authenticates users and rejects invalid credentials or missing tokens', async () => {
    const login = await request('POST', '/api/auth/login', {
      email: 'farmer@example.test',
      password: 'SafePassword123!',
    });
    const denied = await request('POST', '/api/auth/login', {
      email: 'farmer@example.test',
      password: 'incorrect',
    });
    const unauthenticated = await request('GET', '/api/farms');
    assert.equal(login.status, 200);
    assert.equal(denied.status, 401);
    assert.equal(unauthenticated.status, 401);
    otherToken = (await request('POST', '/api/auth/register', {
      name: 'Other Farmer',
      email: 'other@example.test',
      password: 'OtherSafePassword123!',
    })).data.token;
  });

  test('returns the current profile but does not disclose another user profile', async () => {
    const profile = await request('GET', '/api/auth/me', undefined, userToken);
    const otherProfile = await request('GET', `/api/auth/user/${userId}`, undefined, otherToken);
    const missingToken = await request('GET', '/api/auth/me');
    assert.equal(profile.status, 200);
    assert.equal(profile.data.user.email, 'farmer@example.test');
    assert.equal(otherProfile.status, 404);
    assert.equal(missingToken.status, 401);
  });

  test('MongoDB record lookups and mutations include the authenticated owner in their filters', async () => {
    const { ownedUserFilter, ownedResourceFilter } = await import('../src/storage/ownershipQueries.js');
    assert.deepEqual(ownedUserFilter('target-id', 'requester-id'), {
      $and: [
        { _id: 'target-id' },
        { _id: 'requester-id' },
      ],
    });
    assert.deepEqual(ownedUserFilter('target-id', 'admin-id', true), {
      $and: [{ _id: 'target-id' }],
    });
    assert.deepEqual(ownedResourceFilter('field-id', 'requester-id'), {
      _id: 'field-id',
      ownerId: 'requester-id',
    });
  });

  test('farm and field schemas reject missing or non-positive required data', async () => {
    const mongoose = await import('mongoose');
    const { default: Farm } = await import('../src/models/Farm.js');
    const { default: Field } = await import('../src/models/Field.js');
    const ownerId = new mongoose.default.Types.ObjectId();
    const farm = new Farm({ ownerId, name: '' });
    const field = new Field({
      ownerId,
      farmId: new mongoose.default.Types.ObjectId(),
      name: 'Low area',
      areaHectares: 0,
    });
    await assert.rejects(farm.validate(), /Farm name is required/);
    await assert.rejects(field.validate(), /Field area must be greater than zero/);
  });

  test('creates, lists, updates, and deletes farms owned by the authenticated user', async () => {
    const created = await request('POST', '/api/farms', {
      name: 'North Field Farm',
      location: { region: 'North' },
    }, userToken);
    assert.equal(created.status, 201);
    farmId = created.data.farm._id;

    const list = await request('GET', '/api/farms', undefined, userToken);
    const update = await request('PATCH', `/api/farms/${farmId}`, {
      name: 'North Farm',
    }, userToken);
    const otherRead = await request('GET', `/api/farms/${farmId}`, undefined, otherToken);
    assert.equal(list.data.farms.length, 1);
    assert.equal(update.data.farm.name, 'North Farm');
    assert.equal(otherRead.status, 404);
  });

  test('creates, lists, edits, and deletes fields and blocks farm deletion while fields exist', async () => {
    const invalid = await request('POST', `/api/farms/${farmId}/fields`, {
      name: 'Invalid field',
      areaHectares: 0,
    }, userToken);
    const created = await request('POST', `/api/farms/${farmId}/fields`, {
      name: 'East Plot',
      areaHectares: 2.5,
      soilType: 'Loam',
    }, userToken);
    assert.equal(invalid.status, 400);
    assert.equal(created.status, 201);
    fieldId = created.data.field._id;

    const list = await request('GET', `/api/farms/${farmId}/fields`, undefined, userToken);
    const otherList = await request('GET', `/api/farms/${farmId}/fields`, undefined, otherToken);
    const update = await request('PATCH', `/api/farms/fields/${fieldId}`, {
      areaHectares: 3,
    }, userToken);
    const farmDelete = await request('DELETE', `/api/farms/${farmId}`, undefined, userToken);
    assert.equal(list.data.fields.length, 1);
    assert.equal(otherList.status, 404);
    assert.equal(update.data.field.areaHectares, 3);
    assert.equal(farmDelete.status, 409);
  });

  test('prevents either account from reading, changing, or deleting the other account’s farms and fields', async () => {
    const otherFarm = await request('POST', '/api/farms', {
      name: 'Other Farmer Farm',
    }, otherToken);
    assert.equal(otherFarm.status, 201);
    otherFarmId = otherFarm.data.farm._id;

    const otherField = await request('POST', `/api/farms/${otherFarmId}/fields`, {
      name: 'Other Farmer Field',
      areaHectares: 4,
    }, otherToken);
    assert.equal(otherField.status, 201);
    otherFieldId = otherField.data.field._id;

    for (const attempt of [
      { token: userToken, farmId: otherFarmId, fieldId: otherFieldId },
      { token: otherToken, farmId, fieldId },
    ]) {
      assert.equal((await request('GET', `/api/farms/${attempt.farmId}`, undefined, attempt.token)).status, 404);
      assert.equal((await request('PATCH', `/api/farms/${attempt.farmId}`, {
        name: 'Unauthorized farm update',
      }, attempt.token)).status, 404);
      assert.equal((await request('DELETE', `/api/farms/${attempt.farmId}`, undefined, attempt.token)).status, 404);
      assert.equal((await request('GET', `/api/farms/${attempt.farmId}/fields`, undefined, attempt.token)).status, 404);
      assert.equal((await request('POST', `/api/farms/${attempt.farmId}/fields`, {
        name: 'Unauthorized field',
        areaHectares: 1,
      }, attempt.token)).status, 404);
      assert.equal((await request('PATCH', `/api/farms/fields/${attempt.fieldId}`, {
        name: 'Unauthorized field update',
      }, attempt.token)).status, 404);
      assert.equal((await request('DELETE', `/api/farms/fields/${attempt.fieldId}`, undefined, attempt.token)).status, 404);
    }

    const ownerFarm = await request('GET', `/api/farms/${farmId}`, undefined, userToken);
    const otherOwnerFarm = await request('GET', `/api/farms/${otherFarmId}`, undefined, otherToken);
    const ownerFields = await request('GET', `/api/farms/${farmId}/fields`, undefined, userToken);
    const otherOwnerFields = await request('GET', `/api/farms/${otherFarmId}/fields`, undefined, otherToken);
    assert.equal(ownerFarm.data.farm.name, 'North Farm');
    assert.equal(otherOwnerFarm.data.farm.name, 'Other Farmer Farm');
    assert.equal(ownerFields.data.fields[0]._id, fieldId);
    assert.equal(ownerFields.data.fields[0].name, 'East Plot');
    assert.equal(otherOwnerFields.data.fields[0]._id, otherFieldId);
    assert.equal(otherOwnerFields.data.fields[0].name, 'Other Farmer Field');
  });

  test('does not grant an administrator access to another account’s farms or fields', async () => {
    await stores.userStore.create({
      name: 'Test Administrator',
      email: 'administrator@example.test',
      password: 'SafeAdministratorPassword123!',
      role: 'admin',
    });
    const login = await request('POST', '/api/auth/login', {
      email: 'administrator@example.test',
      password: 'SafeAdministratorPassword123!',
    });
    assert.equal(login.status, 200);

    const adminToken = login.data.token;
    assert.equal((await request('GET', '/api/farms', undefined, adminToken)).data.farms.length, 0);
    assert.equal((await request('GET', `/api/farms/${farmId}`, undefined, adminToken)).status, 404);
    assert.equal((await request('PATCH', `/api/farms/${farmId}`, {
      name: 'Unauthorized administrator update',
    }, adminToken)).status, 404);
    assert.equal((await request('DELETE', `/api/farms/${farmId}`, undefined, adminToken)).status, 404);
    assert.equal((await request('GET', `/api/farms/${farmId}/fields`, undefined, adminToken)).status, 404);
    assert.equal((await request('PATCH', `/api/farms/fields/${fieldId}`, {
      name: 'Unauthorized administrator field update',
    }, adminToken)).status, 404);
    assert.equal((await request('DELETE', `/api/farms/fields/${fieldId}`, undefined, adminToken)).status, 404);

    const ownerFarm = await request('GET', `/api/farms/${farmId}`, undefined, userToken);
    const ownerFields = await request('GET', `/api/farms/${farmId}/fields`, undefined, userToken);
    assert.equal(ownerFarm.data.farm.name, 'North Farm');
    assert.equal(ownerFields.data.fields[0].name, 'East Plot');
  });

  test('deletes owned fields and then their farm; rejects malformed JSON safely', async () => {
    const deleteOtherField = await request('DELETE', `/api/farms/fields/${otherFieldId}`, undefined, otherToken);
    const deleteOtherFarm = await request('DELETE', `/api/farms/${otherFarmId}`, undefined, otherToken);
    const deleteField = await request('DELETE', `/api/farms/fields/${fieldId}`, undefined, userToken);
    const deleteFarm = await request('DELETE', `/api/farms/${farmId}`, undefined, userToken);
    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(deleteOtherField.status, 200);
    assert.equal(deleteOtherFarm.status, 200);
    assert.equal(deleteField.status, 200);
    assert.equal(deleteFarm.status, 200);
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: 'Validation Error',
      message: 'Request body must be valid JSON.',
    });
  });

});

describe('Explicit offline development storage', () => {
  test('uses an isolated local directory only when explicitly selected and creates no demo records', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { spawnSync } = await import('node:child_process');
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'agritech-isolated-'));
    const localWorkflow = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      const { connectDB } = await import('./src/config/db.js');
      await connectDB();
      assert.equal(fs.existsSync(process.env.LOCAL_DATA_DIR + '/users.json'), false);
      const { default: app } = await import('./src/app.js');
      const server = await new Promise((resolve, reject) => {
        const instance = app.listen(0, () => resolve(instance));
        instance.on('error', reject);
      });
      try {
        const baseUrl = 'http://127.0.0.1:' + server.address().port;
        const registration = await fetch(baseUrl + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Offline Farmer',
            email: 'offline@example.test',
            password: 'SafeOfflinePassword123!',
          }),
        });
        const registered = await registration.json();
        assert.equal(registration.status, 201);
        assert.equal(registered.user.email, 'offline@example.test');
        const secondRegistration = await fetch(baseUrl + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Another Farmer',
            email: 'second@example.test',
            password: 'AnotherSafePassword123!',
          }),
        });
        assert.equal(secondRegistration.status, 201);
        const farmResponse = await fetch(baseUrl + '/api/farms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + registered.token,
          },
          body: JSON.stringify({ name: 'Offline Farm' }),
        });
        const createdFarm = await farmResponse.json();
        assert.equal(farmResponse.status, 201);
        const fieldResponse = await fetch(baseUrl + '/api/farms/' + createdFarm.farm._id + '/fields', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + registered.token,
          },
          body: JSON.stringify({ name: 'Offline field', areaHectares: 1.25 }),
        });
        assert.equal(fieldResponse.status, 201);
        const healthResponse = await fetch(baseUrl + '/api/health');
        assert.equal(healthResponse.status, 200);
        assert.equal((await healthResponse.json()).status, 'degraded');
        assert.equal(JSON.parse(fs.readFileSync(process.env.LOCAL_DATA_DIR + '/farms.json')).length, 1);
        assert.equal(JSON.parse(fs.readFileSync(process.env.LOCAL_DATA_DIR + '/fields.json')).length, 1);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    `;

    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', localWorkflow], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          JWT_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
          MONGODB_URI: '',
          STORAGE_MODE: 'local-json',
          LOCAL_DATA_DIR: temporaryDirectory,
        },
      });
      assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
