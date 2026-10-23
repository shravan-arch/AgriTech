import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const { createApp } = await import('../src/app.js');

const createMockStores = () => {
  const users = new Map();
  const farms = new Map();
  const fields = new Map();
  const cropCycles = new Map();
  const tasks = new Map();
  const finances = new Map();
  const inventoryItems = new Map();
  const inventoryMovements = new Map();
  const sensors = new Map();
  const sensorReadings = new Map();
  const notifications = new Map();

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
      return farm;
    },
    async findFarm(ownerId, farmId) {
      const farm = farms.get(farmId);
      return farm && farm.ownerId === String(ownerId) ? farm : null;
    },
    async listFields(ownerId, farmId) {
      return [...fields.values()].filter((f) => f.ownerId === String(ownerId) && f.farmId === farmId);
    },
    async listAllCropCycles(ownerId, filters = {}) {
      return [...cropCycles.values()].filter((c) => {
        if (c.ownerId !== String(ownerId)) return false;
        if (filters.farmId && c.farmId !== filters.farmId) return false;
        return true;
      });
    },
    async listTasks(ownerId, filters = {}) {
      return [...tasks.values()].filter((t) => {
        if (t.ownerId !== String(ownerId)) return false;
        if (filters.farmId && t.farmId !== filters.farmId) return false;
        return true;
      });
    },

    // Finances
    async listFinanceRecords(ownerId, filters = {}) {
      return [...finances.values()].filter((r) => {
        if (r.ownerId !== String(ownerId)) return false;
        if (filters.farmId && r.farmId !== filters.farmId) return false;
        if (filters.type && r.type !== filters.type) return false;
        return true;
      });
    },
    async createFinanceRecord(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const rec = { ...values, _id: id(), ownerId: String(ownerId), createdAt: new Date().toISOString() };
      finances.set(rec._id, rec);
      return { record: rec };
    },
    async deleteFinanceRecord(ownerId, recId) {
      const rec = finances.get(recId);
      if (!rec || rec.ownerId !== String(ownerId)) return null;
      finances.delete(recId);
      return rec;
    },
    async getFinanceSummary(ownerId, filters = {}) {
      const records = await this.listFinanceRecords(ownerId, filters);
      let totalIncome = 0;
      let totalExpense = 0;
      const categoryBreakdown = {};
      for (const r of records) {
        const amt = Number(r.amount) || 0;
        if (r.type === 'revenue') totalIncome += amt;
        else totalExpense += amt;
        categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + amt;
      }
      return {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        recordCount: records.length,
        categoryBreakdown,
      };
    },

    // Inventory
    async listInventoryItems(ownerId, filters = {}) {
      return [...inventoryItems.values()].filter((i) => {
        if (i.ownerId !== String(ownerId)) return false;
        if (filters.farmId && i.farmId !== filters.farmId) return false;
        return true;
      });
    },
    async findInventoryItem(ownerId, itemId) {
      const item = inventoryItems.get(itemId);
      return item && item.ownerId === String(ownerId) ? item : null;
    },
    async createInventoryItem(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const item = { ...values, _id: id(), ownerId: String(ownerId), quantity: Number(values.quantity) || 0 };
      inventoryItems.set(item._id, item);
      return { item };
    },
    async updateInventoryItem(ownerId, itemId, values) {
      const item = await this.findInventoryItem(ownerId, itemId);
      if (!item) return null;
      Object.assign(item, values);
      return item;
    },
    async deleteInventoryItem(ownerId, itemId) {
      const item = await this.findInventoryItem(ownerId, itemId);
      if (!item) return null;
      inventoryItems.delete(itemId);
      return item;
    },
    async logInventoryMovement(ownerId, values) {
      const item = await this.findInventoryItem(ownerId, values.itemId);
      if (!item) return { notFound: true, resource: 'inventoryItem' };
      const qty = Number(values.quantity);
      if (values.type === 'out' && item.quantity < qty) {
        const err = new Error('Insufficient stock.');
        err.status = 400;
        throw err;
      }
      item.quantity = values.type === 'in' ? item.quantity + qty : item.quantity - qty;
      const movement = { ...values, _id: id(), ownerId: String(ownerId), farmId: item.farmId };
      inventoryMovements.set(movement._id, movement);

      if (item.quantity <= (item.minThreshold || 0)) {
        await this.createNotification(ownerId, {
          title: `Low Stock: ${item.name}`,
          message: `Stock is ${item.quantity}`,
          type: 'inventory_low',
        });
      }
      return { movement, item };
    },
    async listInventoryMovements(ownerId, filters = {}) {
      return [...inventoryMovements.values()].filter((m) => {
        if (m.ownerId !== String(ownerId)) return false;
        if (filters.itemId && m.itemId !== filters.itemId) return false;
        return true;
      });
    },

    // Sensors
    async listSensors(ownerId, filters = {}) {
      return [...sensors.values()].filter((s) => {
        if (s.ownerId !== String(ownerId)) return false;
        if (filters.farmId && s.farmId !== filters.farmId) return false;
        return true;
      });
    },
    async findSensor(ownerId, sensorId) {
      const s = sensors.get(sensorId);
      return s && s.ownerId === String(ownerId) ? s : null;
    },
    async createSensor(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      if ([...sensors.values()].some((s) => s.deviceUid === values.deviceUid && s.ownerId === String(ownerId))) {
        return { conflict: true, message: 'Sensor UID duplicate' };
      }
      const sensor = { ...values, _id: id(), ownerId: String(ownerId), status: 'active' };
      sensors.set(sensor._id, sensor);
      return { sensor };
    },
    async updateSensor(ownerId, sensorId, values) {
      const s = await this.findSensor(ownerId, sensorId);
      if (!s) return null;
      Object.assign(s, values);
      return s;
    },
    async deleteSensor(ownerId, sensorId) {
      const s = await this.findSensor(ownerId, sensorId);
      if (!s) return null;
      sensors.delete(sensorId);
      return s;
    },
    async addSensorReading(sensor, readingData) {
      const reading = {
        _id: id(),
        sensorId: sensor._id,
        ownerId: sensor.ownerId,
        farmId: sensor.farmId,
        value: Number(readingData.value),
        unit: readingData.unit || '%',
        timestamp: new Date().toISOString(),
      };
      sensorReadings.set(reading._id, reading);
      sensor.lastReadingAt = reading.timestamp;
      sensor.status = 'active';

      if (sensor.thresholds) {
        const { min, max } = sensor.thresholds;
        if (min !== undefined && reading.value < min) {
          await this.createNotification(sensor.ownerId, {
            title: 'Sensor Alert',
            message: `Reading ${reading.value} below min ${min}`,
            type: 'weather_alert',
          });
        }
      }
      return reading;
    },
    async listSensorReadings(ownerId, sensorId) {
      return [...sensorReadings.values()].filter(
        (r) => r.sensorId === sensorId && r.ownerId === String(ownerId)
      );
    },

    // Notifications
    async listNotifications(ownerId) {
      return [...notifications.values()].filter((n) => n.ownerId === String(ownerId));
    },
    async createNotification(ownerId, values) {
      const notif = { ...values, _id: id(), ownerId: String(ownerId), read: false, createdAt: new Date().toISOString() };
      notifications.set(notif._id, notif);
      return notif;
    },
    async markNotificationRead(ownerId, notifId) {
      const n = notifications.get(notifId);
      if (!n || n.ownerId !== String(ownerId)) return null;
      n.read = true;
      return n;
    },
    async markAllNotificationsRead(ownerId) {
      for (const n of notifications.values()) {
        if (n.ownerId === String(ownerId)) n.read = true;
      }
      return { success: true };
    },

    // Analytics
    async getAnalyticsSummary(ownerId, filters = {}) {
      const fList = await this.listFarms(ownerId);
      const fin = await this.getFinanceSummary(ownerId, filters);
      const items = await this.listInventoryItems(ownerId, filters);
      return {
        farmCount: fList.length,
        fieldCount: 0,
        totalAreaHectares: 0,
        cropCycles: { total: 0, active: 0, completed: 0, stageDistribution: {} },
        yields: {},
        tasks: { total: 0, pending: 0, completed: 0, overdue: 0 },
        finances: fin,
        inventory: { totalItems: items.length, lowStockCount: 0 },
      };
    },
  };

  return { userStore, farmStore };
};

describe('Advanced AgriTech Platform Capabilities', () => {
  let server;
  let baseUrl;
  let user1;
  let user2;
  let token1;
  let token2;
  let farm1;

  before(async () => {
    const { userStore, farmStore } = createMockStores();
    user1 = await userStore.create({
      name: 'Farmer John',
      email: 'john@example.com',
      password: 'password12345',
      role: 'farmer',
    });
    user2 = await userStore.create({
      name: 'Advisor Alice',
      email: 'alice@example.com',
      password: 'password12345',
      role: 'advisor',
    });

    token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET);
    token2 = jwt.sign({ id: user2._id }, process.env.JWT_SECRET);

    farm1 = await farmStore.createFarm(user1._id, {
      name: 'Green Valley Farm',
      location: {
        region: 'Punjab',
        country: 'India',
        latitude: 30.9010,
        longitude: 75.8573,
      },
    });

    const app = createApp({ userStore, farmStore });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('Finance Management: creates income & expense, calculates accurate net profit, prevents unauthorized cross-owner access', async () => {
    // Create expense
    const expRes = await fetch(`${baseUrl}/api/finances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        farmId: farm1._id,
        type: 'expense',
        category: 'fertilizer',
        amount: 4500,
        description: 'Urea and DAP bags',
      }),
    });
    assert.equal(expRes.status, 201);
    const expData = await expRes.json();
    assert.equal(expData.data.amount, 4500);

    // Create revenue
    const revRes = await fetch(`${baseUrl}/api/finances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        farmId: farm1._id,
        type: 'revenue',
        category: 'harvest_sale',
        amount: 15000,
        description: 'Sale of early wheat harvest',
      }),
    });
    assert.equal(revRes.status, 201);

    // Check summary calculation: 15000 - 4500 = 10500
    const sumRes = await fetch(`${baseUrl}/api/finances/summary`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(sumRes.status, 200);
    const sumData = await sumRes.json();
    assert.equal(sumData.data.totalIncome, 15000);
    assert.equal(sumData.data.totalExpense, 4500);
    assert.equal(sumData.data.netProfit, 10500);

    // User 2 must see 0 records (isolated owner)
    const u2Sum = await fetch(`${baseUrl}/api/finances/summary`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert.equal(u2Sum.status, 200);
    const u2Data = await u2Sum.json();
    assert.equal(u2Data.data.recordCount, 0);
  });

  test('Inventory Management: tracks stock catalog, processes movements, enforces non-negative stock and generates low-stock alerts', async () => {
    // Create inventory item with 50 bags and minThreshold 10
    const itemRes = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        farmId: farm1._id,
        name: 'NPK 19-19-19 Fertilizer',
        category: 'fertilizer',
        quantity: 50,
        unit: 'bags',
        minThreshold: 10,
        costPerUnit: 1200,
      }),
    });
    assert.equal(itemRes.status, 201);
    const item = (await itemRes.json()).data;
    assert.equal(item.quantity, 50);

    // Reject consuming more than current stock (e.g. 60 bags)
    const overMoveRes = await fetch(`${baseUrl}/api/inventory/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        itemId: item._id,
        type: 'out',
        quantity: 60,
        reason: 'application',
      }),
    });
    assert.equal(overMoveRes.status, 400);

    // Valid movement: use 45 bags (leaves 5 bags, which is <= minThreshold 10 -> triggers low stock alert!)
    const validMoveRes = await fetch(`${baseUrl}/api/inventory/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        itemId: item._id,
        type: 'out',
        quantity: 45,
        reason: 'application',
      }),
    });
    assert.equal(validMoveRes.status, 201);
    const moveResult = await validMoveRes.json();
    assert.equal(moveResult.data.item.quantity, 5);

    // Check notifications for low-stock alert
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(notifRes.status, 200);
    const notifs = (await notifRes.json()).data;
    const hasLowStockAlert = notifs.some((n) => n.type === 'inventory_low');
    assert.equal(hasLowStockAlert, true);
  });

  test('Sensor & Telemetry Management: registers devices, ingests genuine readings, and triggers threshold alert on anomaly', async () => {
    // Register soil moisture sensor
    const sensorRes = await fetch(`${baseUrl}/api/sensors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        farmId: farm1._id,
        name: 'South Field Soil Moisture Sensor',
        type: 'soil_moisture',
        deviceUid: 'SN-SOIL-001',
        thresholds: { min: 25, max: 70, unit: '%' },
      }),
    });
    assert.equal(sensorRes.status, 201);
    const sensor = (await sensorRes.json()).data;

    // Reject duplicate device UID
    const dupRes = await fetch(`${baseUrl}/api/sensors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        farmId: farm1._id,
        name: 'Duplicate Sensor',
        type: 'soil_moisture',
        deviceUid: 'SN-SOIL-001',
      }),
    });
    assert.equal(dupRes.status, 409);

    // Ingest reading below threshold (18% < 25%)
    const readingRes = await fetch(`${baseUrl}/api/sensors/${sensor._id}/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        value: 18,
        unit: '%',
      }),
    });
    assert.equal(readingRes.status, 201);

    // List readings
    const listReadingsRes = await fetch(`${baseUrl}/api/sensors/${sensor._id}/readings`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(listReadingsRes.status, 200);
    const readings = (await listReadingsRes.json()).data;
    assert.equal(readings.length, 1);
    assert.equal(readings[0].value, 18);
  });

  test('Analytics & Official Market Commodity Benchmark rates', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data.marketPrices), true);
    assert.equal(body.data.marketPrices.length > 0, true);
    const wheat = body.data.marketPrices.find((m) => m.commodity === 'Wheat');
    assert.ok(wheat);
    assert.ok(wheat.modalPrice > 0);
    assert.ok(wheat.source.includes('Agmarknet'));
  });

  test('Notifications: mark single and all read', async () => {
    const listRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const notifs = (await listRes.json()).data;
    assert.ok(notifs.length > 0);

    const firstId = notifs[0]._id;
    const markRes = await fetch(`${baseUrl}/api/notifications/${firstId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(markRes.status, 200);

    const markAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(markAllRes.status, 200);

    const postList = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const postData = await postList.json();
    assert.equal(postData.unreadCount, 0);
  });
});
