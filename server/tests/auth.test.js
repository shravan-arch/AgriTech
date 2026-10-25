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
  const cropCycles = new Map();
  const farmActivities = new Map();
  const tasks = new Map();
  const fieldPhotos = new Map();
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
      for (const [tId, task] of tasks.entries()) {
        if (task.farmId === farmId) tasks.delete(tId);
      }
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
      for (const [cId, cycle] of cropCycles.entries()) {
        if (cycle.fieldId === fieldId) cropCycles.delete(cId);
      }
      for (const [aId, act] of farmActivities.entries()) {
        if (act.fieldId === fieldId) farmActivities.delete(aId);
      }
      for (const [tId, task] of tasks.entries()) {
        if (task.fieldId === fieldId) tasks.delete(tId);
      }
      for (const [pId, photo] of fieldPhotos.entries()) {
        if (photo.fieldId === fieldId) fieldPhotos.delete(pId);
      }
      return field;
    },
    async listCropCycles(ownerId, filters = {}) {
      return [...cropCycles.values()].filter((cycle) => {
        if (cycle.ownerId !== String(ownerId)) return false;
        if (filters.farmId && cycle.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && cycle.fieldId !== String(filters.fieldId)) return false;
        if (filters.status && cycle.status !== filters.status) return false;
        return true;
      });
    },
    async findCropCycle(ownerId, cycleId, options = {}) {
      const cycle = cropCycles.get(cycleId);
      if (!cycle || cycle.ownerId !== String(ownerId)) return null;
      if (options.farmId && cycle.farmId !== String(options.farmId)) return null;
      if (options.fieldId && cycle.fieldId !== String(options.fieldId)) return null;
      return cycle;
    },
    async createCropCycle(ownerId, farmId, fieldId, values) {
      const farm = await this.findFarm(ownerId, farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = fields.get(fieldId);
      if (!field || field.ownerId !== String(ownerId) || field.farmId !== String(farmId)) {
        return { notFound: true, resource: 'field' };
      }
      const targetStatus = values.status || 'active';
      if (targetStatus === 'active') {
        const existingActive = [...cropCycles.values()].find(
          (c) => c.ownerId === String(ownerId) && c.fieldId === String(fieldId) && c.status === 'active'
        );
        if (existingActive) {
          return { conflict: true, message: 'An active crop cycle already exists on this field.' };
        }
      }
      const cycle = {
        status: targetStatus,
        stage: values.stage || 'sowing',
        ...values,
        _id: id(),
        farmId,
        fieldId,
        ownerId: String(ownerId),
      };
      cropCycles.set(cycle._id, cycle);
      return { cycle };
    },
    async updateCropCycle(ownerId, cycleId, values, options = {}) {
      const cycle = await this.findCropCycle(ownerId, cycleId, options);
      if (!cycle) return null;
      const targetStatus = values.status !== undefined ? values.status : cycle.status;
      if (targetStatus === 'active' && cycle.status !== 'active') {
        const existingActive = [...cropCycles.values()].find(
          (c) =>
            c._id !== cycleId &&
            c.ownerId === String(ownerId) &&
            c.fieldId === String(cycle.fieldId) &&
            c.status === 'active'
        );
        if (existingActive) {
          return { conflict: true, message: 'An active crop cycle already exists on this field.' };
        }
      }
      Object.assign(cycle, values);
      return { cycle };
    },
    async deleteCropCycle(ownerId, cycleId, options = {}) {
      const cycle = await this.findCropCycle(ownerId, cycleId, options);
      if (!cycle) return null;
      cropCycles.delete(cycleId);
      for (const photo of fieldPhotos.values()) {
        if (photo.cropCycleId === cycleId) photo.cropCycleId = undefined;
      }
      return cycle;
    },

    // FarmActivity
    async listActivities(ownerId, filters = {}) {
      return [...farmActivities.values()].filter((act) => {
        if (act.ownerId !== String(ownerId)) return false;
        if (filters.farmId && act.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && act.fieldId !== String(filters.fieldId)) return false;
        if (filters.cropCycleId && act.cropCycleId !== String(filters.cropCycleId)) return false;
        if (filters.type && act.type !== filters.type) return false;
        if (filters.startDate && new Date(act.date) < new Date(filters.startDate)) return false;
        if (filters.endDate && new Date(act.date) > new Date(filters.endDate)) return false;
        return true;
      }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    },
    async findActivity(ownerId, activityId, options = {}) {
      const act = farmActivities.get(activityId);
      if (!act || act.ownerId !== String(ownerId)) return null;
      if (options.farmId && act.farmId !== String(options.farmId)) return null;
      if (options.fieldId && act.fieldId !== String(options.fieldId)) return null;
      return act;
    },
    async createActivity(ownerId, farmId, fieldId, values) {
      const farm = await this.findFarm(ownerId, farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = fields.get(fieldId);
      if (!field || field.ownerId !== String(ownerId) || field.farmId !== String(farmId)) {
        return { notFound: true, resource: 'field' };
      }
      if (values.cropCycleId) {
        const cycle = cropCycles.get(values.cropCycleId);
        if (!cycle || cycle.ownerId !== String(ownerId) || cycle.farmId !== String(farmId) || cycle.fieldId !== String(fieldId)) {
          return { notFound: true, resource: 'cropCycle' };
        }
      }
      const activity = {
        ...values,
        _id: id(),
        farmId,
        fieldId,
        ownerId: String(ownerId),
      };
      farmActivities.set(activity._id, activity);
      return { activity };
    },
    async updateActivity(ownerId, activityId, values, options = {}) {
      const act = await this.findActivity(ownerId, activityId, options);
      if (!act) return null;
      if (values.cropCycleId) {
        const cycle = cropCycles.get(values.cropCycleId);
        if (!cycle || cycle.ownerId !== String(ownerId) || cycle.farmId !== String(act.farmId) || cycle.fieldId !== String(act.fieldId)) {
          return { notFound: true, resource: 'cropCycle' };
        }
      }
      Object.assign(act, values);
      return { activity: act };
    },
    async deleteActivity(ownerId, activityId, options = {}) {
      const act = await this.findActivity(ownerId, activityId, options);
      if (!act) return null;
      farmActivities.delete(activityId);
      return act;
    },

    // Tasks
    async listTasks(ownerId, filters = {}) {
      const now = new Date();
      const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const utcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).getTime();
      const utcEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).getTime();
      const todayStart = Math.min(localStart, utcStart);
      const todayEnd = Math.max(localEnd, utcEnd);

      return [...tasks.values()].filter((task) => {
        if (task.ownerId !== String(ownerId)) return false;
        if (filters.farmId && task.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && task.fieldId !== String(filters.fieldId)) return false;
        if (filters.cropCycleId && task.cropCycleId !== String(filters.cropCycleId)) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.type && task.type !== filters.type) return false;
        if (filters.priority && task.priority !== filters.priority) return false;

        const dueTime = new Date(task.dueDate).getTime();
        if (filters.due === 'overdue') {
          if (dueTime >= todayStart) return false;
          if (!filters.status && (task.status === 'completed' || task.status === 'cancelled')) return false;
        } else if (filters.due === 'today') {
          if (dueTime < todayStart || dueTime > todayEnd) return false;
        } else if (filters.due === 'upcoming') {
          if (dueTime < todayStart) return false;
        }
        return true;
      }).sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
    },
    async findTask(ownerId, taskId, options = {}) {
      const task = tasks.get(taskId);
      if (!task || task.ownerId !== String(ownerId)) return null;
      if (options.farmId && task.farmId !== String(options.farmId)) return null;
      if (options.fieldId && task.fieldId !== String(options.fieldId)) return null;
      return task;
    },
    async createTask(ownerId, values) {
      if (values.farmId) {
        const farm = await this.findFarm(ownerId, values.farmId);
        if (!farm) return { notFound: true, resource: 'farm' };
      }
      if (values.fieldId) {
        const field = fields.get(values.fieldId);
        if (!field || field.ownerId !== String(ownerId) || (values.farmId && field.farmId !== String(values.farmId))) {
          return { notFound: true, resource: 'field' };
        }
      }
      if (values.cropCycleId) {
        const cycle = cropCycles.get(values.cropCycleId);
        if (!cycle || cycle.ownerId !== String(ownerId)) {
          return { notFound: true, resource: 'cropCycle' };
        }
      }
      const task = {
        priority: 'medium',
        status: 'pending',
        type: 'general',
        ...values,
        _id: id(),
        ownerId: String(ownerId),
        completedAt: values.status === 'completed' ? new Date().toISOString() : undefined,
      };
      tasks.set(task._id, task);
      return { task };
    },
    async updateTask(ownerId, taskId, values, options = {}) {
      const task = await this.findTask(ownerId, taskId, options);
      if (!task) return null;
      if (values.status === 'completed' && !task.completedAt) {
        task.completedAt = new Date().toISOString();
      } else if (values.status && values.status !== 'completed') {
        task.completedAt = null;
      }
      Object.assign(task, values);
      return { task };
    },
    async deleteTask(ownerId, taskId, options = {}) {
      const task = await this.findTask(ownerId, taskId, options);
      if (!task) return null;
      tasks.delete(taskId);
      return task;
    },

    // FieldPhoto methods
    async listPhotos(ownerId, filters = {}) {
      return [...fieldPhotos.values()]
        .filter((photo) => {
          if (photo.ownerId !== String(ownerId)) return false;
          if (filters.farmId && photo.farmId !== String(filters.farmId)) return false;
          if (filters.fieldId && photo.fieldId !== String(filters.fieldId)) return false;
          if (filters.cropCycleId && photo.cropCycleId !== String(filters.cropCycleId)) return false;
          return true;
        })
        .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));
    },
    async findPhoto(ownerId, photoId, options = {}) {
      const photo = fieldPhotos.get(photoId);
      if (!photo || photo.ownerId !== String(ownerId)) return null;
      if (options.farmId && photo.farmId !== String(options.farmId)) return null;
      if (options.fieldId && photo.fieldId !== String(options.fieldId)) return null;
      return photo;
    },
    async createPhoto(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = fields.get(values.fieldId);
      if (!field || field.ownerId !== String(ownerId) || field.farmId !== String(values.farmId)) {
        return { notFound: true, resource: 'field' };
      }
      if (values.cropCycleId) {
        const cycle = cropCycles.get(values.cropCycleId);
        if (!cycle || cycle.ownerId !== String(ownerId)) {
          return { notFound: true, resource: 'cropCycle' };
        }
      }
      const photo = {
        ...values,
        _id: id(),
        ownerId: String(ownerId),
        capturedAt: values.capturedAt ? new Date(values.capturedAt).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      fieldPhotos.set(photo._id, photo);
      return { photo };
    },
    async updatePhoto(ownerId, photoId, values, options = {}) {
      const photo = await this.findPhoto(ownerId, photoId, options);
      if (!photo) return null;
      if (values.cropCycleId) {
        const cycle = cropCycles.get(values.cropCycleId);
        if (!cycle || cycle.ownerId !== String(ownerId)) {
          return { notFound: true, resource: 'cropCycle' };
        }
      }
      Object.assign(photo, values);
      return { photo };
    },
    async deletePhoto(ownerId, photoId, options = {}) {
      const photo = await this.findPhoto(ownerId, photoId, options);
      if (!photo) return null;
      fieldPhotos.delete(photoId);
      return photo;
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

const uploadPhotoRequest = async (route, { buffer, filename = 'test.jpg', fields = {} }, token) => {
  const formData = new FormData();
  if (buffer) {
    const blob = new Blob([buffer]);
    formData.append('photo', blob, filename);
  }
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return { status: response.status, data: await response.json() };
};

const getPhotoFileRequest = async (route, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'GET',
    headers,
  });
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    contentLength: response.headers.get('content-length'),
    cacheControl: response.headers.get('cache-control'),
    buffer: response.ok ? Buffer.from(await response.arrayBuffer()) : null,
    data: !response.ok ? await response.json().catch(() => null) : null,
  };
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

  test('validates, creates, lists, updates, and completes crop cycles on owned fields', async () => {
    // 1. Validation errors
    const missingName = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
      cropName: '',
      plantingDate: '2026-10-01',
    }, userToken);
    assert.equal(missingName.status, 400);

    const invalidDateOrder = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
      cropName: 'Wheat',
      plantingDate: '2026-10-15',
      expectedHarvestDate: '2026-09-01', // earlier than planting!
    }, userToken);
    assert.equal(invalidDateOrder.status, 400);

    const invalidStage = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
      cropName: 'Wheat',
      plantingDate: '2026-10-01',
      stage: 'unknown_stage',
    }, userToken);
    assert.equal(invalidStage.status, 400);

    // 2. Reject cycle creation on mismatched farm/field
    const mismatchedFarm = await request('POST', `/api/farms/${otherFarmId}/fields/${fieldId}/crop-cycles`, {
      cropName: 'Wheat',
      plantingDate: '2026-10-01',
    }, userToken);
    assert.equal(mismatchedFarm.status, 404);

    // 3. Create valid active cycle
    const created = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
      cropName: 'Wheat',
      variety: 'Sonalika',
      season: 'Rabi',
      plantingDate: '2026-10-01',
      expectedHarvestDate: '2027-02-15',
      stage: 'sowing',
      notes: 'Initial test sowing',
    }, userToken);
    assert.equal(created.status, 201);
    const cycleId = created.data.cropCycle._id;
    assert.equal(created.data.cropCycle.cropName, 'Wheat');
    assert.equal(created.data.cropCycle.stage, 'sowing');
    assert.equal(created.data.cropCycle.status, 'active');

    // 4. Prevent second active cycle on the same field
    const duplicateActive = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
      cropName: 'Mustard',
      plantingDate: '2026-10-05',
    }, userToken);
    assert.equal(duplicateActive.status, 409);

    // 5. List cycles for field and rollup endpoint
    const fieldCycles = await request('GET', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, undefined, userToken);
    assert.equal(fieldCycles.status, 200);
    assert.equal(fieldCycles.data.cropCycles.length, 1);
    assert.equal(fieldCycles.data.cropCycles[0]._id, cycleId);

    const allActive = await request('GET', '/api/farms/crop-cycles?status=active', undefined, userToken);
    assert.equal(allActive.status, 200);
    assert.equal(allActive.data.cropCycles.length, 1);
    assert.equal(allActive.data.cropCycles[0]._id, cycleId);

    // 6. Cross-account access denied
    const otherView = await request('GET', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, undefined, otherToken);
    assert.equal(otherView.status, 404);
    const otherGet = await request('GET', `/api/farms/crop-cycles/${cycleId}`, undefined, otherToken);
    assert.equal(otherGet.status, 404);
    const otherPatch = await request('PATCH', `/api/farms/crop-cycles/${cycleId}`, { stage: 'flowering' }, otherToken);
    assert.equal(otherPatch.status, 404);
    const otherDelete = await request('DELETE', `/api/farms/crop-cycles/${cycleId}`, undefined, otherToken);
    assert.equal(otherDelete.status, 404);

    // 7. Update lifecycle stage
    const updateStage = await request('PATCH', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles/${cycleId}`, {
      stage: 'vegetative',
    }, userToken);
    assert.equal(updateStage.status, 200);
    assert.equal(updateStage.data.cropCycle.stage, 'vegetative');

    // 8. Mark cycle completed with harvest date
    const completeCycle = await request('PATCH', `/api/farms/crop-cycles/${cycleId}`, {
      stage: 'harvested',
      status: 'completed',
      harvestDate: '2027-02-14',
    }, userToken);
    assert.equal(completeCycle.status, 200);
    assert.equal(completeCycle.data.cropCycle.status, 'completed');
    assert.equal(completeCycle.data.cropCycle.stage, 'harvested');

    // 9. Now that previous cycle is completed, allow a new active cycle on the same field
    const newCycle = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
      cropName: 'Moong',
      season: 'Zaid',
      plantingDate: '2027-03-01',
      stage: 'sowing',
    }, userToken);
    assert.equal(newCycle.status, 201);
    const newCycleId = newCycle.data.cropCycle._id;

    // Field now has 2 total cycles (1 active, 1 completed historical)
    const historyCycles = await request('GET', `/api/farms/${farmId}/fields/${fieldId}/crop-cycles`, undefined, userToken);
    assert.equal(historyCycles.data.cropCycles.length, 2);

    // Delete the new cycle
    const deleteCycle = await request('DELETE', `/api/farms/crop-cycles/${newCycleId}`, undefined, userToken);
    assert.equal(deleteCycle.status, 200);
  });

  test('FarmActivity and Task schemas validate required fields and boundaries', async () => {
    const mongoose = await import('mongoose');
    const { default: FarmActivity } = await import('../src/models/FarmActivity.js');
    const { default: Task } = await import('../src/models/Task.js');
    const ownerId = new mongoose.default.Types.ObjectId();
    const farmId = new mongoose.default.Types.ObjectId();
    const fieldId = new mongoose.default.Types.ObjectId();

    const invalidActivity = new FarmActivity({
      ownerId,
      farmId,
      fieldId,
      type: 'invalid_type',
      date: new Date(),
    });
    await assert.rejects(invalidActivity.validate(), /Invalid activity type/);

    const negativeCostActivity = new FarmActivity({
      ownerId,
      farmId,
      fieldId,
      type: 'irrigation',
      date: new Date(),
      cost: -50,
    });
    await assert.rejects(negativeCostActivity.validate(), /Cost must be non-negative/);

    const invalidTask = new Task({
      ownerId,
      title: '',
      dueDate: new Date(),
    });
    await assert.rejects(invalidTask.validate(), /Task title is required/);

    const invalidTaskPriority = new Task({
      ownerId,
      title: 'Water crop',
      dueDate: new Date(),
      priority: 'super_urgent',
    });
    await assert.rejects(invalidTaskPriority.validate(), /Invalid task priority/);
  });

  test('validates, creates, filters, updates, and completes farm activities and operational tasks with owner isolation', async () => {
    // 1. Activity validation
    const missingType = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/activities`, {
      date: '2026-10-21',
    }, userToken);
    assert.equal(missingType.status, 400);

    const invalidActType = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/activities`, {
      type: 'skydiving',
      date: '2026-10-21',
    }, userToken);
    assert.equal(invalidActType.status, 400);

    const invalidCost = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/activities`, {
      type: 'fertilizer',
      date: '2026-10-21',
      cost: -10,
    }, userToken);
    assert.equal(invalidCost.status, 400);

    // Invalid foreign ID format
    const malformedForeignId = await request('POST', `/api/farms/not-an-id/fields/${fieldId}/activities`, {
      type: 'irrigation',
      date: '2026-10-21',
    }, userToken);
    assert.equal(malformedForeignId.status, 400);

    const malformedTaskForeignId = await request('POST', '/api/farms/tasks', {
      title: 'Inspect pump',
      dueDate: '2026-10-25',
      farmId: 'invalid-id-format',
    }, userToken);
    assert.equal(malformedTaskForeignId.status, 400);

    // Mismatched farm/field
    const mismatchedFarm = await request('POST', `/api/farms/${otherFarmId}/fields/${fieldId}/activities`, {
      type: 'irrigation',
      date: '2026-10-21',
    }, userToken);
    assert.equal(mismatchedFarm.status, 404);

    // 2. Create valid activity
    const activityRes = await request('POST', `/api/farms/${farmId}/fields/${fieldId}/activities`, {
      type: 'fertilizer',
      date: '2026-10-21',
      notes: 'Applied urea to wheat plot',
      performedBy: 'Ramesh',
      cost: 450,
      inputs: [{ name: 'Urea', quantity: 25, unit: 'kg' }],
    }, userToken);
    assert.equal(activityRes.status, 201);
    const activityId = activityRes.data.activity._id;
    assert.equal(activityRes.data.activity.type, 'fertilizer');
    assert.equal(activityRes.data.activity.inputs[0].name, 'Urea');
    assert.equal(activityRes.data.activity.inputs[0].quantity, 25);

    // 3. List activities (field-level and owner-level)
    const fieldActivities = await request('GET', `/api/farms/${farmId}/fields/${fieldId}/activities`, undefined, userToken);
    assert.equal(fieldActivities.status, 200);
    assert.equal(fieldActivities.data.activities.length, 1);
    assert.equal(fieldActivities.data.activities[0]._id, activityId);

    const allActivities = await request('GET', '/api/farms/activities?type=fertilizer', undefined, userToken);
    assert.equal(allActivities.status, 200);
    assert.equal(allActivities.data.activities.length, 1);

    // 4. Activity owner isolation
    const otherActList = await request('GET', `/api/farms/${farmId}/fields/${fieldId}/activities`, undefined, otherToken);
    assert.equal(otherActList.status, 404);
    const otherActGet = await request('GET', `/api/farms/activities/${activityId}`, undefined, otherToken);
    assert.equal(otherActGet.status, 404);
    const otherActPatch = await request('PATCH', `/api/farms/activities/${activityId}`, { notes: 'Hacked' }, otherToken);
    assert.equal(otherActPatch.status, 404);
    const otherActDelete = await request('DELETE', `/api/farms/activities/${activityId}`, undefined, otherToken);
    assert.equal(otherActDelete.status, 404);

    // 5. Update activity
    const updatedAct = await request('PATCH', `/api/farms/activities/${activityId}`, {
      notes: 'Updated application notes',
      cost: 500,
    }, userToken);
    assert.equal(updatedAct.status, 200);
    assert.equal(updatedAct.data.activity.notes, 'Updated application notes');
    assert.equal(updatedAct.data.activity.cost, 500);

    // 6. Task validation
    const missingTitle = await request('POST', '/api/farms/tasks', {
      dueDate: '2026-10-25',
    }, userToken);
    assert.equal(missingTitle.status, 400);

    const invalidPriority = await request('POST', '/api/farms/tasks', {
      title: 'Valid task',
      dueDate: '2026-10-25',
      priority: 'critical_emergency',
    }, userToken);
    assert.equal(invalidPriority.status, 400);

    // Mismatched task farm
    const mismatchedTaskFarm = await request('POST', '/api/farms/tasks', {
      title: 'Inspect irrigation pump',
      dueDate: '2026-10-25',
      farmId: otherFarmId,
    }, userToken);
    assert.equal(mismatchedTaskFarm.status, 404);

    // 7. Create overdue, due-today, and upcoming tasks
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const overdueTask = await request('POST', '/api/farms/tasks', {
      title: 'Fix drip nozzle leak',
      type: 'irrigation',
      dueDate: yesterday,
      priority: 'high',
      farmId,
      fieldId,
    }, userToken);
    assert.equal(overdueTask.status, 201);
    const overdueTaskId = overdueTask.data.task._id;

    const todayTask = await request('POST', '/api/farms/tasks', {
      title: 'Inspect wheat plot moisture',
      type: 'inspection',
      dueDate: today,
      priority: 'medium',
      farmId,
      fieldId,
    }, userToken);
    assert.equal(todayTask.status, 201);
    const todayTaskId = todayTask.data.task._id;

    const upcomingTask = await request('POST', '/api/farms/tasks', {
      title: 'Pre-harvest weed inspection',
      type: 'inspection',
      dueDate: nextWeek,
      priority: 'low',
      farmId,
      fieldId,
    }, userToken);
    assert.equal(upcomingTask.status, 201);
    const upcomingTaskId = upcomingTask.data.task._id;

    // 8. Due filters
    const overdueList = await request('GET', '/api/farms/tasks?due=overdue', undefined, userToken);
    assert.equal(overdueList.status, 200);
    assert.ok(overdueList.data.tasks.some((t) => t._id === overdueTaskId));
    assert.ok(!overdueList.data.tasks.some((t) => t._id === upcomingTaskId));

    const todayList = await request('GET', '/api/farms/tasks?due=today', undefined, userToken);
    assert.equal(todayList.status, 200);
    assert.ok(todayList.data.tasks.some((t) => t._id === todayTaskId));

    const upcomingList = await request('GET', '/api/farms/tasks?due=upcoming', undefined, userToken);
    assert.equal(upcomingList.status, 200);
    assert.ok(upcomingList.data.tasks.some((t) => t._id === upcomingTaskId));

    // 9. Task owner isolation
    const otherTaskGet = await request('GET', `/api/farms/tasks/${todayTaskId}`, undefined, otherToken);
    assert.equal(otherTaskGet.status, 404);
    const otherTaskComplete = await request('POST', `/api/farms/tasks/${todayTaskId}/complete`, {}, otherToken);
    assert.equal(otherTaskComplete.status, 404);
    const otherTaskPatch = await request('PATCH', `/api/farms/tasks/${todayTaskId}`, { title: 'Unauthorized' }, otherToken);
    assert.equal(otherTaskPatch.status, 404);
    const otherTaskDelete = await request('DELETE', `/api/farms/tasks/${todayTaskId}`, undefined, otherToken);
    assert.equal(otherTaskDelete.status, 404);

    // 10. Complete task via dedicated complete endpoint
    const initialActivityCount = (await request('GET', '/api/farms/activities', undefined, userToken)).data.activities.length;
    const completed = await request('POST', `/api/farms/tasks/${todayTaskId}/complete`, {}, userToken);
    assert.equal(completed.status, 200);
    assert.equal(completed.data.task.status, 'completed');
    assert.ok(completed.data.task.completedAt);

    // Verify task completion does NOT create a FarmActivity automatically (distinctness rule)
    const afterActivityCount = (await request('GET', '/api/farms/activities', undefined, userToken)).data.activities.length;
    assert.equal(afterActivityCount, initialActivityCount);

    // 11. Reopen task clears completedAt
    const reopened = await request('PATCH', `/api/farms/tasks/${todayTaskId}`, {
      status: 'in_progress',
    }, userToken);
    assert.equal(reopened.status, 200);
    assert.equal(reopened.data.task.status, 'in_progress');
    assert.equal(reopened.data.task.completedAt, null);

    // Cleanup created test tasks and activities
    assert.equal((await request('DELETE', `/api/farms/tasks/${overdueTaskId}`, undefined, userToken)).status, 200);
    assert.equal((await request('DELETE', `/api/farms/tasks/${todayTaskId}`, undefined, userToken)).status, 200);
    assert.equal((await request('DELETE', `/api/farms/tasks/${upcomingTaskId}`, undefined, userToken)).status, 200);
    assert.equal((await request('DELETE', `/api/farms/activities/${activityId}`, undefined, userToken)).status, 200);
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

describe('Phase 3: Secure Field Photographs and Visual History', () => {
  const VALID_JPEG_BUFFER = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  ]);

  const VALID_PNG_BUFFER = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  ]);

  const SPOOFED_TEXT_BUFFER = Buffer.from('NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT_DATA');

  let photoFarmId;
  let photoFieldId;
  let otherPhotoFarmId;
  let otherPhotoFieldId;
  let testPhotoId;
  let testCycleId;

  before(async () => {
    const farmRes = await request('POST', '/api/farms', { name: 'Photo Test Farm' }, userToken);
    photoFarmId = farmRes.data.farm._id;
    const fieldRes = await request(
      'POST',
      `/api/farms/${photoFarmId}/fields`,
      { name: 'North Vineyard', areaHectares: 2.5 },
      userToken
    );
    photoFieldId = fieldRes.data.field._id;

    const otherFarmRes = await request('POST', '/api/farms', { name: 'Other Photo Farm' }, otherToken);
    otherPhotoFarmId = otherFarmRes.data.farm._id;
    const otherFieldRes = await request(
      'POST',
      `/api/farms/${otherPhotoFarmId}/fields`,
      { name: 'South Orchard', areaHectares: 3 },
      otherToken
    );
    otherPhotoFieldId = otherFieldRes.data.field._id;
  });

  test('rejects unauthenticated photo upload or access', async () => {
    const uploadRes = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      { buffer: VALID_JPEG_BUFFER },
      null
    );
    assert.equal(uploadRes.status, 401);

    const listRes = await request('GET', `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`);
    assert.equal(listRes.status, 401);
  });

  test('rejects photo upload without an image file', async () => {
    const res = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      { buffer: null, fields: { notes: 'No file attached' } },
      userToken
    );
    assert.equal(res.status, 400);
    assert.match(res.data.message, /Photograph image file is required/i);
  });

  test('rejects photo upload with spoofed magic bytes (non-image payload with image extension)', async () => {
    const res = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      { buffer: SPOOFED_TEXT_BUFFER, filename: 'fake_crop.jpg' },
      userToken
    );
    assert.equal(res.status, 400);
    assert.match(res.data.message, /magic bytes do not match/i);
  });

  test('rejects photo upload exceeding size limit', async () => {
    // Create buffer exceeding 10MB
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff;

    const res = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      { buffer: largeBuffer, filename: 'huge_crop.jpg' },
      userToken
    );
    assert.equal(res.status, 400);
    assert.match(res.data.message, /exceeds maximum allowed limit of 10MB/i);
  });

  test('uploads authentic JPEG photograph with field, capture date, crop cycle, and notes', async () => {
    // First create a crop cycle to link
    const cycleRes = await request(
      'POST',
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/crop-cycles`,
      {
        cropName: 'Barley',
        plantingDate: '2026-05-01',
        season: 'Spring',
      },
      userToken
    );
    assert.equal(cycleRes.status, 201);
    testCycleId = cycleRes.data.cropCycle._id;

    const uploadRes = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      {
        buffer: VALID_JPEG_BUFFER,
        filename: 'field_survey_may.jpg',
        fields: {
          cropCycleId: testCycleId,
          capturedAt: '2026-05-15T10:00:00.000Z',
          notes: 'Sprouts emerging evenly across north quadrant.',
        },
      },
      userToken
    );

    assert.equal(uploadRes.status, 201);
    assert.ok(uploadRes.data.photo);
    assert.equal(uploadRes.data.photo.mimeType, 'image/jpeg');
    assert.equal(uploadRes.data.photo.fileSize, VALID_JPEG_BUFFER.length);
    assert.equal(uploadRes.data.photo.farmId, photoFarmId);
    assert.equal(uploadRes.data.photo.fieldId, photoFieldId);
    assert.equal(uploadRes.data.photo.cropCycleId, testCycleId);
    assert.equal(uploadRes.data.photo.notes, 'Sprouts emerging evenly across north quadrant.');
    assert.ok(uploadRes.data.photo.storageKey);

    testPhotoId = uploadRes.data.photo._id;
  });

  test('uploads authentic PNG photo and lists photographs chronologically', async () => {
    const secondPhotoRes = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      {
        buffer: VALID_PNG_BUFFER,
        filename: 'field_june.png',
        fields: {
          capturedAt: '2026-06-01T10:00:00.000Z',
          notes: 'Crop canopy fully closed.',
        },
      },
      userToken
    );
    assert.equal(secondPhotoRes.status, 201);

    const listRes = await request(
      'GET',
      `/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`,
      undefined,
      userToken
    );
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.photos));
    assert.ok(listRes.data.photos.length >= 2);

    // Latest photo (June) should be before earlier photo (May)
    const dates = listRes.data.photos.map((p) => new Date(p.capturedAt).getTime());
    assert.ok(dates[0] >= dates[1]);
  });

  test('enforces owner-level authorization for metadata access', async () => {
    // Owner can retrieve metadata
    const ownerRes = await request(
      'GET',
      `/api/farms/photos/${testPhotoId}`,
      undefined,
      userToken
    );
    assert.equal(ownerRes.status, 200);
    assert.equal(ownerRes.data.photo._id, testPhotoId);

    // Another authenticated user gets 404 (no information disclosure)
    const otherUserRes = await request(
      'GET',
      `/api/farms/photos/${testPhotoId}`,
      undefined,
      otherToken
    );
    assert.equal(otherUserRes.status, 404);
  });

  test('streams photograph image bytes with proper headers and owner authorization', async () => {
    // Owner can stream photo file
    const streamRes = await getPhotoFileRequest(
      `/api/farms/photos/${testPhotoId}/file`,
      userToken
    );
    assert.equal(streamRes.status, 200);
    assert.equal(streamRes.contentType, 'image/jpeg');
    assert.equal(streamRes.contentLength, String(VALID_JPEG_BUFFER.length));
    assert.equal(streamRes.cacheControl, 'private, max-age=3600');
    assert.deepEqual(streamRes.buffer, VALID_JPEG_BUFFER);

    // Other user cannot stream photo file
    const otherStream = await getPhotoFileRequest(
      `/api/farms/photos/${testPhotoId}/file`,
      otherToken
    );
    assert.equal(otherStream.status, 404);

    // Unauthenticated request cannot stream photo file
    const unauthStream = await getPhotoFileRequest(
      `/api/farms/photos/${testPhotoId}/file`,
      null
    );
    assert.equal(unauthStream.status, 401);
  });

  test('updates observation notes and capture date', async () => {
    const updateRes = await request(
      'PATCH',
      `/api/farms/photos/${testPhotoId}`,
      {
        notes: 'Updated note: Minor aphid signs observed on leaves.',
        capturedAt: '2026-05-16T12:00:00.000Z',
      },
      userToken
    );
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.photo.notes, 'Updated note: Minor aphid signs observed on leaves.');

    // Other user cannot update photo
    const otherUpdate = await request(
      'PATCH',
      `/api/farms/photos/${testPhotoId}`,
      { notes: 'Hacked note' },
      otherToken
    );
    assert.equal(otherUpdate.status, 404);
  });

  test('deletes photograph and cleans up metadata and stored bytes', async () => {
    // Other user cannot delete photo
    const otherDelete = await request(
      'DELETE',
      `/api/farms/photos/${testPhotoId}`,
      undefined,
      otherToken
    );
    assert.equal(otherDelete.status, 404);

    // Owner deletes photo
    const deleteRes = await request(
      'DELETE',
      `/api/farms/photos/${testPhotoId}`,
      undefined,
      userToken
    );
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.data.success, true);

    // Metadata access now returns 404
    const getRes = await request('GET', `/api/farms/photos/${testPhotoId}`, undefined, userToken);
    assert.equal(getRes.status, 404);

    // File access now returns 404
    const fileRes = await getPhotoFileRequest(`/api/farms/photos/${testPhotoId}/file`, userToken);
    assert.equal(fileRes.status, 404);
  });

  test('cascades photo deletion when parent field is deleted', async () => {
    // Create new field
    const fieldRes = await request(
      'POST',
      `/api/farms/${photoFarmId}/fields`,
      { name: 'Photo Cascade Field', areaHectares: 1.5 },
      userToken
    );
    assert.equal(fieldRes.status, 201);
    const cFieldId = fieldRes.data.field._id;

    // Upload photo to this field
    const uploadRes = await uploadPhotoRequest(
      `/api/farms/${photoFarmId}/fields/${cFieldId}/photos`,
      { buffer: VALID_PNG_BUFFER, filename: 'cascade.png' },
      userToken
    );
    assert.equal(uploadRes.status, 201);
    const cPhotoId = uploadRes.data.photo._id;

    // Delete the field
    const delFieldRes = await request('DELETE', `/api/farms/fields/${cFieldId}`, undefined, userToken);
    assert.equal(delFieldRes.status, 200);

    // Photo should be gone
    const getPhotoRes = await request('GET', `/api/farms/photos/${cPhotoId}`, undefined, userToken);
    assert.equal(getPhotoRes.status, 404);
  });

  test('handles storage adapter failure gracefully with 500 error response', async () => {
    const failingStorage = {
      async savePhoto() {
        throw new Error('S3 Disk Connection Timeout.');
      },
      async getPhoto() {
        throw new Error('Storage Read Failure.');
      },
      async deletePhoto() {},
    };

    const failingApp = createApp({
      userStore: stores.userStore,
      farmStore: stores.farmStore,
      photoStorage: failingStorage,
    });

    const failingServer = failingApp.listen(0);
    const failingBaseUrl = `http://127.0.0.1:${failingServer.address().port}`;

    try {
      const formData = new FormData();
      const blob = new Blob([VALID_JPEG_BUFFER]);
      formData.append('photo', blob, 'sample.jpg');

      const response = await fetch(`${failingBaseUrl}/api/farms/${photoFarmId}/fields/${photoFieldId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: formData,
      });

      assert.equal(response.status, 500);
      const data = await response.json();
      assert.equal(data.error, 'Storage Failure');
      assert.match(data.message, /S3 Disk Connection Timeout/i);
    } finally {
      await new Promise((resolve) => failingServer.close(resolve));
    }
  });
});

describe('Persistence failure and fallback regression tests', () => {
  test('rejects writes and reports failure without falling back to local JSON when persistent storage is unavailable', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { spawnSync } = await import('node:child_process');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agritech-regr-'));

    const testScript = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import path from 'node:path';

      const { userStore } = await import('./src/storage/userStore.js');
      const { farmStore } = await import('./src/storage/farmStore.js');
      const { getDBStatus } = await import('./src/config/db.js');

      assert.equal(getDBStatus().mode, 'unavailable');
      assert.equal(getDBStatus().isAvailable, false);

      // Verify userStore.create fails and no local JSON is written
      await assert.rejects(
        () => userStore.create({ name: 'Fail User', email: 'fail@example.com', password: 'SafePassword123!' }),
        /Persistent storage is unavailable/
      );
      assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'users.json')), false);

      // Verify farmStore operations fail and no local JSON is written
      await assert.rejects(
        () => farmStore.createFarm('000000000000000000000001', { name: 'Failing Farm' }),
        /Persistent storage is unavailable/
      );
      assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'farms.json')), false);

      await assert.rejects(
        () => farmStore.createField('000000000000000000000001', '000000000000000000000002', { name: 'Failing Field', areaHectares: 2 }),
        /Persistent storage is unavailable/
      );
      assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'fields.json')), false);

      await assert.rejects(
        () => farmStore.deleteFarm('000000000000000000000001', '000000000000000000000002'),
        /Persistent storage is unavailable/
      );

      await assert.rejects(
        () => farmStore.deleteField('000000000000000000000001', '000000000000000000000003'),
        /Persistent storage is unavailable/
      );
    `;

    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', testScript], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          JWT_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
          MONGODB_URI: '',
          STORAGE_MODE: '',
          LOCAL_DATA_DIR: tempDir,
        },
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('reports internal server error on API requests when database is disconnected and never writes local files', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { spawnSync } = await import('node:child_process');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agritech-api-regr-'));

    const testScript = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import path from 'node:path';

      const { userStore } = await import('./src/storage/userStore.js');
      const { farmStore } = await import('./src/storage/farmStore.js');
      const { createApp } = await import('./src/app.js');

      const app = createApp({ userStore, farmStore });
      const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      const baseUrl = 'http://127.0.0.1:' + server.address().port;

      try {
        const response = await fetch(baseUrl + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'API Fail User',
            email: 'apifail@example.com',
            password: 'SafePassword123!',
          }),
        });

        assert.equal(response.status, 500);
        const data = await response.json();
        assert.equal(data.error, 'Internal Server Error');
        assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'users.json')), false);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    `;

    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', testScript], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          JWT_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
          MONGODB_URI: '',
          STORAGE_MODE: '',
          LOCAL_DATA_DIR: tempDir,
        },
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('propagates database write failures and never silently falls back to local JSON store', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { spawnSync } = await import('node:child_process');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agritech-mongo-err-'));

    const testScript = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import path from 'node:path';

      // Import models and simulate MongoDB write failure
      const { default: User } = await import('./src/models/User.js');
      const { default: Farm } = await import('./src/models/Farm.js');
      const { default: Field } = await import('./src/models/Field.js');

      User.create = async () => {
        const error = new Error('Mongo connection timed out during write');
        error.name = 'MongoServerError';
        throw error;
      };

      Farm.create = async () => {
        const error = new Error('Mongo write concern error');
        error.name = 'MongoServerError';
        throw error;
      };

      Field.create = async () => {
        const error = new Error('Mongo write failed');
        error.name = 'MongoServerError';
        throw error;
      };

      // Set mongoose connection readyState to 1 and mock db to simulate active mongodb mode
      const mongoose = (await import('mongoose')).default;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
      mongoose.connection.db = { collection: () => ({ createIndex: async () => {} }) };

      const { userStore } = await import('./src/storage/userStore.js');
      const { farmStore } = await import('./src/storage/farmStore.js');

      // Verify that database errors are thrown directly and never fall back to local JSON
      await assert.rejects(
        () => userStore.create({ name: 'Mongo Fail User', email: 'mfail@example.com', password: 'SafePassword123!' }),
        /Mongo connection timed out during write/
      );
      assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'users.json')), false);

      await assert.rejects(
        () => farmStore.createFarm('000000000000000000000001', { name: 'Mongo Fail Farm' }),
        /Mongo write concern error/
      );
      assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'farms.json')), false);

      await assert.rejects(
        () => farmStore.createField('000000000000000000000001', '000000000000000000000002', { name: 'Mongo Fail Field', areaHectares: 3 }),
        /Mongo write failed/
      );
      assert.equal(fs.existsSync(path.join(process.env.LOCAL_DATA_DIR, 'fields.json')), false);
    `;

    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', testScript], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          JWT_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
          MONGODB_URI: '',
          STORAGE_MODE: '',
          LOCAL_DATA_DIR: tempDir,
        },
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getSafeConnectionDetails properly parses connection URIs and redacts sensitive credentials', async () => {
    const { getSafeConnectionDetails, getDBStatus } = await import('../src/config/db.js');
    const originalUri = process.env.MONGODB_URI;

    try {
      // 1. Placeholder template rejection
      process.env.MONGODB_URI = 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/agritech?retryWrites=true&w=majority';
      const placeholderDetails = getSafeConnectionDetails();
      assert.equal(placeholderDetails.configured, false);
      assert.equal(placeholderDetails.host, null);

      // 2. Valid URI parsing without exposing credentials
      process.env.MONGODB_URI = 'mongodb+srv://app_user:SuperSecretPassword123@my-cluster.mongodb.net/agritech_db?retryWrites=true&w=majority';
      const validDetails = getSafeConnectionDetails();
      assert.equal(validDetails.configured, true);
      assert.equal(validDetails.host, 'my-cluster.mongodb.net');
      assert.equal(validDetails.database, 'agritech_db');
      assert.equal(JSON.stringify(validDetails).includes('SuperSecretPassword123'), false);

      // 3. getDBStatus returns diagnostics object
      const status = getDBStatus();
      assert.ok(status.diagnostics);
      assert.equal(typeof status.diagnostics.attempted, 'boolean');
      assert.equal(typeof status.diagnostics.success, 'boolean');
    } finally {
      process.env.MONGODB_URI = originalUri;
    }
  });
});
