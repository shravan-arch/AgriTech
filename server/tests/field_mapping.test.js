import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  validateGeoJSONPolygon,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculatePolygonCenter,
  calculatePolygonBoundingBox,
} from '../src/utils/geoUtils.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const { createApp } = await import('../src/app.js');

describe('Farm & Field Mapping: Geometry Validation & Area Calculations', () => {
  // A 100m x 100m square polygon at equator (approx 0.000898315 deg)
  const d = 100 / 111320;
  const sampleSquare100m = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [d, 0],
        [d, d],
        [0, d],
        [0, 0],
      ],
    ],
  };

  test('valid GeoJSON polygon passes validation', () => {
    const result = validateGeoJSONPolygon(sampleSquare100m);
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  test('rejects non-object or null boundary', () => {
    assert.equal(validateGeoJSONPolygon(null).valid, false);
    assert.equal(validateGeoJSONPolygon('invalid').valid, false);
  });

  test('rejects non-Polygon geometry types', () => {
    const point = { type: 'Point', coordinates: [75.85, 30.9] };
    const res = validateGeoJSONPolygon(point);
    assert.equal(res.valid, false);
    assert.match(res.error, /Polygon/);
  });

  test('rejects unclosed linear ring (first point != last point)', () => {
    const unclosed = {
      type: 'Polygon',
      coordinates: [
        [
          [75.85, 30.9],
          [75.86, 30.9],
          [75.86, 30.91],
          [75.85, 30.91],
          // missing closing point [75.85, 30.9]
        ],
      ],
    };
    const res = validateGeoJSONPolygon(unclosed);
    assert.equal(res.valid, false);
    assert.match(res.error, /closed/i);
  });

  test('rejects ring with fewer than 4 positions', () => {
    const tooFew = {
      type: 'Polygon',
      coordinates: [
        [
          [75.85, 30.9],
          [75.86, 30.9],
          [75.85, 30.9],
        ],
      ],
    };
    const res = validateGeoJSONPolygon(tooFew);
    assert.equal(res.valid, false);
    assert.match(res.error, /at least 4/i);
  });

  test('rejects coordinates outside global latitude/longitude bounds', () => {
    const outOfBounds = {
      type: 'Polygon',
      coordinates: [
        [
          [195.0, 30.9],
          [195.1, 30.9],
          [195.1, 30.91],
          [195.0, 30.9],
        ],
      ],
    };
    const res = validateGeoJSONPolygon(outOfBounds);
    assert.equal(res.valid, false);
    assert.match(res.error, /Longitude/i);
  });

  test('calculates spherical area and perimeter accurately', () => {
    const area = calculatePolygonArea(sampleSquare100m.coordinates);
    assert.ok(area.squareMeters >= 9950 && area.squareMeters <= 10050, `Expected ~10000 m2, got ${area.squareMeters}`);
    assert.ok(area.hectares >= 0.99 && area.hectares <= 1.01, `Expected ~1 ha, got ${area.hectares}`);
    assert.ok(area.acres >= 2.45 && area.acres <= 2.50, `Expected ~2.47 acres, got ${area.acres}`);

    const perimeter = calculatePolygonPerimeter(sampleSquare100m.coordinates);
    // 4 sides of 100m = ~400m
    assert.ok(perimeter.meters >= 395 && perimeter.meters <= 405, `Expected ~400m, got ${perimeter.meters}`);
    assert.ok(perimeter.kilometers >= 0.39 && perimeter.kilometers <= 0.41);
  });

  test('calculates centroid and bounding box', () => {
    const center = calculatePolygonCenter(sampleSquare100m.coordinates);
    assert.ok(center.latitude >= 0 && center.latitude <= d);
    assert.ok(center.longitude >= 0 && center.longitude <= d);

    const bbox = calculatePolygonBoundingBox(sampleSquare100m.coordinates);
    assert.equal(bbox[0][0], 0); // minLng
    assert.equal(bbox[0][1], 0); // minLat
    assert.equal(bbox[1][0], d); // maxLng
    assert.equal(bbox[1][1], d); // maxLat
  });
});

describe('Farm & Field Mapping: API, Persistence & Access Control', () => {
  let server;
  let baseUrl;
  let farmerTokenA;
  let farmerIdA;
  let farmerTokenB;
  let farmerIdB;
  let farmIdA;
  let fieldIdA;

  // In-memory mock store for isolated HTTP testing
  const users = new Map();
  const farms = new Map();
  const fields = new Map();
  let nextId = 1;
  const generateId = () => (nextId++).toString(16).padStart(24, '0');

  const mockUserStore = {
    async findById(userId) {
      return users.get(userId) || null;
    },
  };

  const mockFarmStore = {
    async findFarm(ownerId, farmId) {
      const farm = farms.get(farmId);
      return farm && farm.ownerId === String(ownerId) ? farm : null;
    },
    async listFarms(ownerId) {
      return [...farms.values()].filter((f) => f.ownerId === String(ownerId));
    },
    async createFarm(ownerId, values) {
      const farm = { ...values, _id: generateId(), ownerId: String(ownerId), createdAt: new Date().toISOString() };
      farms.set(farm._id, farm);
      return farm;
    },
    async listFields(ownerId, farmId) {
      return [...fields.values()].filter((f) => {
        if (f.ownerId !== String(ownerId)) return false;
        if (farmId && f.farmId !== String(farmId)) return false;
        return true;
      });
    },
    async findField(ownerId, fieldId) {
      const field = fields.get(fieldId);
      return field && field.ownerId === String(ownerId) ? field : null;
    },
    async createField(ownerId, farmId, values) {
      const farm = await this.findFarm(ownerId, farmId);
      if (!farm) return null;
      const field = {
        ...values,
        _id: generateId(),
        farmId: String(farmId),
        ownerId: String(ownerId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fields.set(field._id, field);
      return field;
    },
    async updateField(ownerId, fieldId, values) {
      const existing = await this.findField(ownerId, fieldId);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...values,
        updatedAt: new Date().toISOString(),
      };
      fields.set(fieldId, updated);
      return updated;
    },
    async deleteField(ownerId, fieldId) {
      const existing = await this.findField(ownerId, fieldId);
      if (!existing) return null;
      fields.delete(fieldId);
      return existing;
    },
  };

  before(async () => {
    farmerIdA = generateId();
    farmerIdB = generateId();

    users.set(farmerIdA, {
      _id: farmerIdA,
      id: farmerIdA,
      name: 'Farmer Harpreet',
      email: 'harpreet@punjabagro.in',
      role: 'farmer',
      status: 'active',
    });

    users.set(farmerIdB, {
      _id: farmerIdB,
      id: farmerIdB,
      name: 'Farmer Ramesh',
      email: 'ramesh@gujaratfarms.in',
      role: 'farmer',
      status: 'active',
    });

    farmerTokenA = jwt.sign({ id: farmerIdA }, process.env.JWT_SECRET);
    farmerTokenB = jwt.sign({ id: farmerIdB }, process.env.JWT_SECRET);

    const app = createApp({ farmStore: mockFarmStore, userStore: mockUserStore });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  const request = async (method, path, body, token) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  };

  test('Setup: Farmer A creates a farm', async () => {
    const res = await request(
      'POST',
      '/api/farms',
      {
        name: 'Punjab Agro Estate',
        location: { region: 'Punjab', city: 'Ludhiana', latitude: 30.9, longitude: 75.85 },
      },
      farmerTokenA
    );
    assert.equal(res.status, 201);
    assert.ok(res.body.farm._id);
    farmIdA = res.body.farm._id;
  });

  test('1. Create field with GeoJSON boundary polygon, automatic metric calculation & legal disclaimer', async () => {
    const boundary = {
      type: 'Polygon',
      coordinates: [
        [
          [75.850, 30.900],
          [75.852, 30.900],
          [75.852, 30.902],
          [75.850, 30.902],
          [75.850, 30.900],
        ],
      ],
    };

    const res = await request(
      'POST',
      `/api/farms/${farmIdA}/fields`,
      {
        name: 'North Wheat Acre',
        soilType: 'Alluvial Soil',
        waterSource: 'Canal Flow',
        boundary,
      },
      farmerTokenA
    );

    assert.equal(res.status, 201);
    const field = res.body.field;
    assert.ok(field._id);
    fieldIdA = field._id;
    assert.equal(field.name, 'North Wheat Acre');
    assert.deepEqual(field.boundary, boundary);

    // Calculated metrics check
    assert.ok(field.calculatedMetrics);
    assert.ok(field.calculatedMetrics.approximateAreaHectares > 0);
    assert.ok(field.calculatedMetrics.approximateAreaAcres > 0);
    assert.ok(field.calculatedMetrics.approximatePerimeterMeters > 0);
    assert.ok(field.calculatedMetrics.calculatedAt);

    // Defaulted areaHectares check
    assert.equal(field.areaHectares, field.calculatedMetrics.approximateAreaHectares);

    // Boundary metadata check
    assert.ok(field.boundaryMetadata);
    assert.equal(field.boundaryMetadata.source, 'user_drawn_approximate');
    assert.equal(field.boundaryMetadata.verificationStatus, 'unverified_approximate');
    assert.match(field.boundaryMetadata.legalDisclaimer, /approximate boundary/i);
    assert.ok(field.boundaryMetadata.lastDrawnAt);
  });

  test('2. Reopen / retrieve field by ID returns GeoJSON boundary and metrics', async () => {
    const res = await request('GET', `/api/farms/fields/${fieldIdA}`, undefined, farmerTokenA);
    assert.equal(res.status, 200);
    assert.equal(res.body.field._id, fieldIdA);
    assert.equal(res.body.field.name, 'North Wheat Acre');
    assert.ok(res.body.field.boundary);
    assert.equal(res.body.field.boundary.type, 'Polygon');
    assert.ok(res.body.field.calculatedMetrics.approximateAreaHectares > 0);
  });

  test('3. Update field boundary recalculates metrics and updates lastDrawnAt', async () => {
    const updatedBoundary = {
      type: 'Polygon',
      coordinates: [
        [
          [75.850, 30.900],
          [75.855, 30.900],
          [75.855, 30.905],
          [75.850, 30.905],
          [75.850, 30.900],
        ],
      ],
    };

    const res = await request(
      'PATCH',
      `/api/farms/fields/${fieldIdA}`,
      {
        boundary: updatedBoundary,
      },
      farmerTokenA
    );

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.field.boundary, updatedBoundary);
    assert.ok(res.body.field.calculatedMetrics.approximateAreaHectares > 0);
    assert.ok(res.body.field.boundaryMetadata.lastDrawnAt);
  });

  test('4. Rejects invalid GeoJSON boundary with 400 Validation Error', async () => {
    const invalidBoundary = {
      type: 'Polygon',
      coordinates: [
        [
          [75.850, 30.900],
          [75.855, 30.900],
          // missing closing point
        ],
      ],
    };

    const res = await request(
      'PATCH',
      `/api/farms/fields/${fieldIdA}`,
      {
        boundary: invalidBoundary,
      },
      farmerTokenA
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation Error');
  });

  test('5. Enforce strict ownership: Farmer B cannot read Farmer A field', async () => {
    const res = await request('GET', `/api/farms/fields/${fieldIdA}`, undefined, farmerTokenB);
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Field not found.');
  });

  test('6. Enforce strict ownership: Farmer B cannot modify Farmer A field boundary', async () => {
    const res = await request(
      'PATCH',
      `/api/farms/fields/${fieldIdA}`,
      {
        name: 'Hacked Field',
      },
      farmerTokenB
    );
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Field not found.');
  });

  test('7. Enforce strict ownership: Farmer B cannot delete Farmer A field', async () => {
    const res = await request('DELETE', `/api/farms/fields/${fieldIdA}`, undefined, farmerTokenB);
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Field not found.');
  });

  test('8. Unauthenticated requests are rejected with 401 Unauthorized', async () => {
    const res = await request('GET', `/api/farms/fields/${fieldIdA}`, undefined, null);
    assert.equal(res.status, 401);
  });

  test('9. List fields returns only the authenticated farmer fields', async () => {
    const resA = await request('GET', '/api/farms/fields', undefined, farmerTokenA);
    assert.equal(resA.status, 200);
    assert.equal(resA.body.fields.length, 1);
    assert.equal(resA.body.fields[0]._id, fieldIdA);

    const resB = await request('GET', '/api/farms/fields', undefined, farmerTokenB);
    assert.equal(resB.status, 200);
    assert.equal(resB.body.fields.length, 0);
  });
});
