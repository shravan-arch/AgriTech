import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';

const testUri = process.env.MONGODB_TEST_URI;
if (!testUri) {
  throw new Error('MONGODB_TEST_URI must point to the dedicated Atlas test database.');
}

let databaseName;
try {
  const parsed = new URL(testUri);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) throw new Error();
  databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
} catch {
  throw new Error('MONGODB_TEST_URI must be a valid MongoDB URI.');
}

if (databaseName !== 'agritech_test') {
  throw new Error('MONGODB_TEST_URI must target the dedicated agritech_test database.');
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-only-secret-not-for-production';
process.env.MONGODB_URI = testUri;

const [{ createApp }, { connectDB, disconnectDB }, { default: User }, { default: Farm }, { default: Field }] =
  await Promise.all([
    import('../../src/app.js'),
    import('../../src/config/db.js'),
    import('../../src/models/User.js'),
    import('../../src/models/Farm.js'),
    import('../../src/models/Field.js'),
  ]);

const runId = randomUUID().replaceAll('-', '');
const testEmails = [
  `agritech${runId}one@example.com`,
  `agritech${runId}two@example.com`,
];
const testUserIds = [];
let server;
let baseUrl;

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
  await connectDB();
  const app = createApp();
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (testUserIds.length) {
    await Promise.all([
      Field.deleteMany({ ownerId: { $in: testUserIds } }),
      Farm.deleteMany({ ownerId: { $in: testUserIds } }),
      User.deleteMany({ _id: { $in: testUserIds } }),
    ]);
  }
  await disconnectDB();
});

test('isolates farm and field operations between two MongoDB-backed accounts', async () => {
  const tokens = [];
  for (const [index, email] of testEmails.entries()) {
    const registration = await request('POST', '/api/auth/register', {
      name: `Integration Farmer ${index + 1}`,
      email,
      password: 'IntegrationSafePassword123!',
    });
    assert.equal(registration.status, 201);
    testUserIds.push(registration.data.user.id || registration.data.user._id);
    tokens.push(registration.data.token);
  }

  const farms = [];
  const fields = [];
  for (const [index, token] of tokens.entries()) {
    const farmResponse = await request('POST', '/api/farms', {
      name: `Integration Farm ${index + 1}`,
    }, token);
    assert.equal(farmResponse.status, 201);
    farms.push(farmResponse.data.farm);

    const fieldResponse = await request('POST', `/api/farms/${farms[index]._id}/fields`, {
      name: `Integration Field ${index + 1}`,
      areaHectares: index + 1,
    }, token);
    assert.equal(fieldResponse.status, 201);
    fields.push(fieldResponse.data.field);
  }

  for (const index of [0, 1]) {
    const otherIndex = 1 - index;
    const token = tokens[index];
    const otherFarmId = farms[otherIndex]._id;
    const otherFieldId = fields[otherIndex]._id;

    assert.equal((await request('GET', `/api/farms/${otherFarmId}`, undefined, token)).status, 404);
    assert.equal((await request('PATCH', `/api/farms/${otherFarmId}`, {
      name: 'Unauthorized update',
    }, token)).status, 404);
    assert.equal((await request('DELETE', `/api/farms/${otherFarmId}`, undefined, token)).status, 404);
    assert.equal((await request('GET', `/api/farms/${otherFarmId}/fields`, undefined, token)).status, 404);
    assert.equal((await request('POST', `/api/farms/${otherFarmId}/fields`, {
      name: 'Unauthorized field',
      areaHectares: 1,
    }, token)).status, 404);
    assert.equal((await request('PATCH', `/api/farms/fields/${otherFieldId}`, {
      name: 'Unauthorized field update',
    }, token)).status, 404);
    assert.equal((await request('DELETE', `/api/farms/fields/${otherFieldId}`, undefined, token)).status, 404);
  }

  for (const index of [0, 1]) {
    const ownFarm = await request('GET', `/api/farms/${farms[index]._id}`, undefined, tokens[index]);
    const ownFields = await request('GET', `/api/farms/${farms[index]._id}/fields`, undefined, tokens[index]);
    assert.equal(ownFarm.data.farm.name, `Integration Farm ${index + 1}`);
    assert.equal(ownFields.data.fields.length, 1);
    assert.equal(ownFields.data.fields[0].name, `Integration Field ${index + 1}`);
  }

  for (const index of [0, 1]) {
    assert.equal((await request('DELETE', `/api/farms/fields/${fields[index]._id}`, undefined, tokens[index])).status, 200);
    assert.equal((await request('DELETE', `/api/farms/${farms[index]._id}`, undefined, tokens[index])).status, 200);
  }
});
