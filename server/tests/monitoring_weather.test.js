import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const { createApp } = await import('../src/app.js');
const { createSensorSimulatorService } = await import('../src/services/sensorSimulatorService.js');
const { default: weatherService } = await import('../src/services/weatherService.js');

const createMockStores = () => {
  const users = new Map();
  const farms = new Map();
  const fields = new Map();
  const sensors = new Map();
  const sensorReadings = new Map();
  const notifications = new Map();
  const weatherSnapshots = new Map();

  let nextId = 1;
  const id = () => (nextId++).toString(16).padStart(24, '0');

  const userStore = {
    async create(values) {
      const user = {
        ...values,
        _id: id(),
        role: values.role || 'farmer',
        async comparePassword(password) {
          return bcrypt.compare(password, this.password);
        },
        toJSON() {
          const { password, ...safe } = this;
          return safe;
        },
      };
      user.id = user._id;
      user.password = await bcrypt.hash(values.password, 4);
      users.set(user._id, user);
      return user;
    },
    async findById(userId) {
      return users.get(userId) || null;
    },
    async findOwnedById(targetId, requesterId, isAdmin) {
      const user = await this.findById(targetId);
      return user && (isAdmin || targetId === requesterId) ? user : null;
    },
  };

  const farmStore = {
    async listFarms(ownerId) {
      return [...farms.values()].filter((f) => f.ownerId === String(ownerId));
    },
    async createFarm(ownerId, values) {
      const farm = { ...values, _id: id(), ownerId: String(ownerId) };
      farms.set(farm._id, farm);
      return { farm };
    },
    async findFarm(ownerId, farmId) {
      const farm = farms.get(farmId);
      return farm && farm.ownerId === String(ownerId) ? farm : null;
    },
    async listAllFarmsWithCoordinates() {
      return [...farms.values()].filter((f) => f.location && f.location.coordinates);
    },
    async listFields(ownerId, filters = {}) {
      return [...fields.values()].filter((f) => {
        if (f.ownerId !== String(ownerId)) return false;
        if (filters.farmId && f.farmId !== filters.farmId) return false;
        return true;
      });
    },
    async createField(ownerId, farmId, values) {
      const farm = await this.findFarm(ownerId, farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = { ...values, _id: id(), farmId, ownerId: String(ownerId) };
      fields.set(field._id, field);
      return { field };
    },
    async findField(ownerId, fieldId) {
      const f = fields.get(fieldId);
      return f && f.ownerId === String(ownerId) ? f : null;
    },
    async listSensors(ownerId, filters = {}) {
      return [...sensors.values()].filter((s) => {
        if (s.ownerId !== String(ownerId)) return false;
        if (filters.farmId && s.farmId !== filters.farmId) return false;
        if (filters.fieldId && s.fieldId !== filters.fieldId) return false;
        return true;
      });
    },
    async findSensor(ownerId, sensorId) {
      const s = sensors.get(sensorId);
      return s && s.ownerId === String(ownerId) ? s : null;
    },
    async findSensorByUid(ownerId, deviceUid) {
      return [...sensors.values()].find((s) => s.ownerId === String(ownerId) && s.deviceUid === deviceUid) || null;
    },
    async createSensor(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const sensor = {
        ...values,
        _id: id(),
        ownerId: String(ownerId),
        status: 'active',
        isSimulated: Boolean(values.isSimulated),
        source: values.source || (values.isSimulated ? 'simulated' : 'physical'),
      };
      sensors.set(sensor._id, sensor);
      return { sensor };
    },
    async updateSensor(ownerId, sensorId, values) {
      const s = await this.findSensor(ownerId, sensorId);
      if (!s) return null;
      Object.assign(s, values);
      return s;
    },
    async addSensorReading(sensor, readingData) {
      const isSimulated = readingData.isSimulated !== undefined ? Boolean(readingData.isSimulated) : Boolean(sensor.isSimulated);
      const source = readingData.source || sensor.source || (isSimulated ? 'simulated' : 'physical');
      const reading = {
        _id: id(),
        sensorId: sensor._id,
        ownerId: sensor.ownerId,
        farmId: sensor.farmId,
        fieldId: sensor.fieldId,
        value: Number(readingData.value),
        unit: readingData.unit || '%',
        isSimulated,
        source,
        timestamp: readingData.timestamp || new Date().toISOString(),
      };
      sensorReadings.set(reading._id, reading);
      sensor.lastReadingAt = reading.timestamp;
      sensor.status = 'active';

      let alert = null;
      if (sensor.thresholds) {
        const { min, max } = sensor.thresholds;
        let breachType = null;
        let severity = 'warning';
        const val = reading.value;

        if (min !== undefined && val < min) {
          breachType = 'low';
          const deficit = (min - val) / (min || 1);
          if (deficit >= 0.25) severity = 'critical';
        } else if (max !== undefined && val > max) {
          breachType = 'high';
          const excess = (val - max) / (max || 1);
          if (excess >= 0.25) severity = 'critical';
        }

        if (breachType) {
          const alertKey = `sensor:${sensor._id}:${breachType}`;
          const existingAlert = [...notifications.values()].find(
            (n) => n.alertKey === alertKey && !n.acknowledged && n.ownerId === String(sensor.ownerId)
          );

          if (!existingAlert) {
            alert = {
              _id: id(),
              ownerId: sensor.ownerId,
              title: `${severity.toUpperCase()}: ${sensor.name} reading out of range`,
              message: `${sensor.type} reading ${val}${reading.unit} is ${breachType} (threshold ${breachType === 'low' ? min : max})`,
              type: 'sensor_alert',
              severity,
              alertKey,
              sensorId: sensor._id,
              farmId: sensor.farmId,
              fieldId: sensor.fieldId,
              isSimulated,
              acknowledged: false,
              createdAt: new Date().toISOString(),
            };
            notifications.set(alert._id, alert);
          }
        }
      }
      return { reading, alert };
    },
    async listSensorReadingsForCharts(ownerId, filters = {}) {
      return [...sensorReadings.values()].filter((r) => {
        if (r.ownerId !== String(ownerId)) return false;
        if (filters.farmId && r.farmId !== filters.farmId) return false;
        if (filters.fieldId && r.fieldId !== filters.fieldId) return false;
        if (filters.sensorId && r.sensorId !== filters.sensorId) return false;
        return true;
      });
    },
    async saveWeatherSnapshot(ownerId, farmId, snapshotData) {
      const snap = {
        _id: id(),
        farmId,
        ownerId,
        timestamp: snapshotData.timestamp || new Date().toISOString(),
        temperature: snapshotData.temperature,
        apparentTemperature: snapshotData.apparentTemperature,
        humidity: snapshotData.humidity,
        precipitation: snapshotData.precipitation,
        rain: snapshotData.rain,
        windSpeed: snapshotData.windSpeed,
        windDirection: snapshotData.windDirection,
        weatherCode: snapshotData.weatherCode,
        condition: snapshotData.condition,
        source: snapshotData.source || 'Open-Meteo',
        isSimulated: Boolean(snapshotData.isSimulated),
        coordinates: snapshotData.coordinates,
      };
      weatherSnapshots.set(snap._id, snap);
      return snap;
    },
    async getLatestWeatherSnapshot(ownerId, farmId) {
      const targetFarmId = farmId || ownerId;
      const farmSnaps = [...weatherSnapshots.values()]
        .filter((s) => s.farmId === targetFarmId || (ownerId && s.ownerId === String(ownerId) && s.farmId === farmId))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return farmSnaps[0] || null;
    },
    async listWeatherSnapshots(ownerId, farmId, filters = {}) {
      return [...weatherSnapshots.values()]
        .filter((s) => {
          if (ownerId && s.ownerId !== String(ownerId)) return false;
          if (farmId && s.farmId !== farmId) return false;
          return true;
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },
    async listAlerts(ownerId, filters = {}) {
      return [...notifications.values()].filter((n) => {
        if (n.ownerId !== String(ownerId)) return false;
        if (filters.acknowledged !== undefined && n.acknowledged !== filters.acknowledged) return false;
        return true;
      });
    },
    async acknowledgeAlert(ownerId, alertId) {
      const alert = notifications.get(alertId);
      if (!alert || alert.ownerId !== String(ownerId)) return null;
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      return alert;
    },
  };

  return { userStore, farmStore };
};

describe('Monitoring, Real Weather & Simulated Sensors', () => {
  let stores;
  let app;
  let server;
  let baseUrl;
  let userToken;
  let otherToken;
  let farmId;
  let fieldId;
  let sensorId;
  let simulatorService;

  const request = async (method, path, body, token) => {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };

  before(async () => {
    stores = createMockStores();
    simulatorService = createSensorSimulatorService();
    app = createApp({
      userStore: stores.userStore,
      farmStore: stores.farmStore,
      simulatorService,
      weatherService,
    });

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const user1 = await stores.userStore.create({
      name: 'Weather Farmer',
      email: 'weather@example.com',
      password: 'StrongPassword123!',
      role: 'farmer',
    });
    userToken = jwt.sign(
      { id: user1._id, role: user1.role, email: user1.email },
      process.env.JWT_SECRET
    );

    const user2 = await stores.userStore.create({
      name: 'Other Farmer',
      email: 'otherfarmer@example.com',
      password: 'StrongPassword123!',
      role: 'farmer',
    });
    otherToken = jwt.sign(
      { id: user2._id, role: user2.role, email: user2.email },
      process.env.JWT_SECRET
    );

    const farmRes = await stores.farmStore.createFarm(user1._id, {
      name: 'Delhi Test Farm',
      location: {
        address: 'New Delhi, India',
        coordinates: [77.2090, 28.6139],
      },
    });
    farmId = farmRes.farm._id;

    const fieldRes = await stores.farmStore.createField(user1._id, farmId, {
      name: 'North Wheat Field',
      area: 5,
      cropType: 'Wheat',
    });
    fieldId = fieldRes.field._id;

    const sensorRes = await stores.farmStore.createSensor(user1._id, {
      name: 'Soil Moisture Sensor 1',
      deviceUid: 'SIM-SOIL-001',
      farmId,
      fieldId,
      type: 'soil_moisture',
      unit: '%',
      thresholds: { min: 30, max: 80 },
    });
    sensorId = sensorRes.sensor._id;
  });

  after(async () => {
    simulatorService.stopAll();
    await new Promise((resolve) => server.close(resolve));
  });

  test('Weather API: rejects unauthenticated requests', async () => {
    const res = await request('GET', `/api/weather/farms/${farmId}`);
    assert.equal(res.status, 401);
  });

  test('Weather API: enforces farm owner isolation', async () => {
    const res = await request('GET', `/api/weather/farms/${farmId}`, undefined, otherToken);
    assert.equal(res.status, 404);
  });

  test('Weather API: fetches live Open-Meteo weather and returns current conditions & forecasts', async () => {
    const res = await request('GET', `/api/weather/farms/${farmId}`, undefined, userToken);
    assert.equal(res.status, 200);
    const weather = res.data.data;
    assert.ok(weather);
    assert.equal(weather.provider, 'Open-Meteo');
    assert.equal(typeof weather.temperature, 'number');
    assert.ok(Array.isArray(weather.hourlyForecast));
    assert.ok(Array.isArray(weather.dailyForecast));
    assert.equal(weather.stale, false);

    // Verify snapshot was stored
    const historyRes = await request('GET', `/api/weather/farms/${farmId}/history`, undefined, userToken);
    assert.equal(historyRes.status, 200);
    const history = historyRes.data.data;
    assert.ok(history.length >= 1);
    const snap = history[0];
    assert.equal(snap.farmId, farmId);
    assert.equal(typeof snap.temperature, 'number');
    assert.ok(snap.source.includes('Open-Meteo'));
  });

  test('Weather API: handles missing farm coordinates gracefully without crashing', async () => {
    const noCoordFarm = await stores.farmStore.createFarm(jwt.decode(userToken).id, {
      name: 'No Location Farm',
    });
    const res = await request('GET', `/api/weather/farms/${noCoordFarm.farm._id}`, undefined, userToken);
    assert.equal(res.status, 400);
    assert.ok(res.data.message.includes('coordinates'));
  });

  test('Weather API: serves cached snapshot with stale flag when external provider fails', async () => {
    // Save an existing snapshot in database
    await stores.farmStore.saveWeatherSnapshot(jwt.decode(userToken).id, farmId, {
      temperature: 24.5,
      humidity: 50,
      precipitation: 0,
      rain: 0,
      windSpeed: 10,
      windDirection: 180,
      weatherCode: 0,
      condition: 'Clear sky',
      source: 'Open-Meteo',
      isSimulated: false,
      coordinates: [77.2090, 28.6139],
    });

    // Create a mock weather service that throws a network timeout
    const failingWeatherService = {
      async getFarmWeather(farm, options = {}) {
        return weatherService.getFarmWeather(farm, {
          ...options,
          fetchFn: async () => {
            throw new Error('ETIMEDOUT: Connection to Open-Meteo timed out');
          },
        });
      },
    };

    const staleApp = createApp({
      userStore: stores.userStore,
      farmStore: stores.farmStore,
      weatherService: failingWeatherService,
    });
    const staleServer = staleApp.listen(0);
    const staleBaseUrl = `http://127.0.0.1:${staleServer.address().port}`;

    try {
      const staleRes = await fetch(`${staleBaseUrl}/api/weather/farms/${farmId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const staleJson = await staleRes.json();
      assert.equal(staleRes.status, 200);
      assert.equal(staleJson.data.stale, true);
      assert.ok(staleJson.data.staleReason.includes('ETIMEDOUT'));
      assert.equal(staleJson.data.temperature, 24.5);
    } finally {
      await new Promise((resolve) => staleServer.close(resolve));
    }
  });

  test('Weather History: supports range filtering (24h, 7d, 30d)', async () => {
    const res24h = await request('GET', `/api/weather/farms/${farmId}/history?range=24h`, undefined, userToken);
    assert.equal(res24h.status, 200);
    assert.ok(Array.isArray(res24h.data.data));

    const res7d = await request('GET', `/api/weather/farms/${farmId}/history?range=7d`, undefined, userToken);
    assert.equal(res7d.status, 200);
    assert.ok(Array.isArray(res7d.data.data));
  });

  test('Simulator: rejects unauthenticated requests', async () => {
    const res = await request('POST', '/api/sensors/simulator/start', {
      farmId,
      fieldId,
    });
    assert.equal(res.status, 401);
  });

  test('Simulator: enforces owner isolation on starting simulation', async () => {
    const res = await request('POST', '/api/sensors/simulator/start', {
      farmId,
      fieldId,
    }, otherToken);
    assert.equal(res.status, 404);
  });

  test('Simulator: starts simulation session and updates status', async () => {
    const res = await request('POST', '/api/sensors/simulator/start', {
      farmId,
      fieldId,
      intervalSeconds: 15,
    }, userToken);
    assert.equal(res.status, 200);
    assert.ok(res.data.message.includes('running'));
    assert.equal(res.data.session.running, true);

    // Status endpoint check
    const statusRes = await request('GET', `/api/sensors/simulator/status?farmId=${farmId}&fieldId=${fieldId}`, undefined, userToken);
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.data.running, true);
  });

  test('Simulator: generates explicit SIMULATED readings with source=simulated', async () => {
    const triggerRes = await request('POST', '/api/sensors/simulator/trigger', {
      farmId,
      fieldId,
      customValue: 55,
    }, userToken);
    assert.equal(triggerRes.status, 201);
    assert.equal(triggerRes.data.data.isSimulated, true);
    assert.equal(triggerRes.data.data.source, 'simulated');
    assert.equal(triggerRes.data.data.value, 55);
  });

  test('Simulator & Alerts: threshold breach generates warning or critical alert with duplicate suppression', async () => {
    // Threshold is min: 30, max: 80.
    // Trigger critical breach: value = 15 (< 30, deficit 50% -> critical)
    const breach1 = await request('POST', '/api/sensors/simulator/trigger', {
      farmId,
      fieldId,
      customValue: 15,
      forceBreach: true,
    }, userToken);
    assert.equal(breach1.status, 201);
    assert.ok(breach1.data.data.alert);
    assert.equal(breach1.data.data.alert.severity, 'critical');
    assert.equal(breach1.data.data.alert.acknowledged, false);
    assert.equal(breach1.data.data.alert.isSimulated, true);

    const alertId = breach1.data.data.alert._id;

    // Trigger duplicate breach immediately -> duplicate alert should be suppressed
    const breachDuplicate = await request('POST', '/api/sensors/simulator/trigger', {
      farmId,
      fieldId,
      customValue: 14,
      forceBreach: true,
    }, userToken);
    assert.equal(breachDuplicate.status, 201);
    // Alert should be null due to 30min debounce
    assert.equal(breachDuplicate.data.data.alert, null);

    // Verify alert appears in alert list
    const alertsList = await request('GET', '/api/sensors/alerts', undefined, userToken);
    assert.equal(alertsList.status, 200);
    const foundAlert = alertsList.data.data.find((a) => a._id === alertId);
    assert.ok(foundAlert);
    assert.equal(foundAlert.acknowledged, false);

    // Acknowledge the alert
    const ackRes = await request('PATCH', `/api/sensors/alerts/${alertId}/acknowledge`, {}, userToken);
    assert.equal(ackRes.status, 200);
    assert.equal(ackRes.data.data.acknowledged, true);
    assert.ok(ackRes.data.data.acknowledgedAt);
  });

  test('Charts & Telemetry: GET /api/sensors/charts returns chronological readings with SIMULATED markers', async () => {
    const chartsRes = await request('GET', `/api/sensors/charts?farmId=${farmId}&fieldId=${fieldId}&range=24h`, undefined, userToken);
    assert.equal(chartsRes.status, 200);
    assert.ok(Array.isArray(chartsRes.data.data));
    assert.ok(chartsRes.data.data.length >= 1);
    const reading = chartsRes.data.data[0];
    assert.equal(reading.isSimulated, true);
    assert.equal(reading.source, 'simulated');
  });

  test('Simulator: stops simulation cleanly and stops generating updates', async () => {
    const stopRes = await request('POST', '/api/sensors/simulator/stop', {
      farmId,
      fieldId,
    }, userToken);
    assert.equal(stopRes.status, 200);
    assert.ok(stopRes.data.message.includes('stopped'));

    const statusRes = await request('GET', `/api/sensors/simulator/status?farmId=${farmId}&fieldId=${fieldId}`, undefined, userToken);
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.data.running, false);
  });

  test('Production Guard: disables all simulator actions when NODE_ENV is production', async () => {
    const oldEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const startRes = await request('POST', '/api/sensors/simulator/start', { farmId, fieldId }, userToken);
      assert.equal(startRes.status, 403);
      assert.ok(startRes.data.message.includes('disabled in production'));

      const triggerRes = await request('POST', '/api/sensors/simulator/trigger', { farmId, fieldId, customValue: 50 }, userToken);
      assert.equal(triggerRes.status, 403);

      const statusRes = await request('GET', `/api/sensors/simulator/status?farmId=${farmId}&fieldId=${fieldId}`, undefined, userToken);
      assert.equal(statusRes.status, 403);

      const stopRes = await request('POST', '/api/sensors/simulator/stop', { farmId, fieldId }, userToken);
      assert.equal(stopRes.status, 403);
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });
});
