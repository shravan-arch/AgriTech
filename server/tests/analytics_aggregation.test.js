import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const { createApp } = await import('../src/app.js');

describe('Analytics Engine, Unit Normalization, and Financial Aggregations', () => {
  let server;
  let baseUrl;
  let user1;
  let user2;
  let token1;
  let token2;

  // In-memory isolated test store
  const users = new Map();
  const farms = new Map();
  const fields = new Map();
  const cropCycles = new Map();
  const financeRecords = new Map();
  let idCounter = 1;
  const newId = () => (idCounter++).toString(16).padStart(24, '0');

  const mockUserStore = {
    async create(userData) {
      const u = {
        ...userData,
        _id: newId(),
        async comparePassword(password) {
          return password === this.password;
        },
        toJSON() {
          const { password, ...safe } = this;
          return safe;
        },
      };
      u.id = u._id;
      users.set(u._id, u);
      return u;
    },
    async findByEmail(email) {
      return [...users.values()].find((u) => u.email === email) || null;
    },
    async findById(id) {
      return users.get(String(id)) || null;
    },
    async findOwnedById(targetId, requesterId, isAdmin) {
      const u = users.get(String(targetId));
      return u && (isAdmin || String(targetId) === String(requesterId)) ? u : null;
    },
    async verifyPassword(user, password) {
      return user && (await user.comparePassword(password));
    },
    async comparePassword(plain, hashed) {
      return plain === hashed;
    },
  };

  const mockFarmStore = {
    async listFarms(ownerId) {
      return [...farms.values()].filter((f) => f.ownerId === String(ownerId));
    },
    async findFarm(ownerId, farmId) {
      const f = farms.get(String(farmId));
      return f && f.ownerId === String(ownerId) ? f : null;
    },
    async listFields(ownerId, farmId) {
      return [...fields.values()].filter(
        (fld) => fld.ownerId === String(ownerId) && fld.farmId === String(farmId)
      );
    },
    async listCropCycles(ownerId, filters = {}) {
      return [...cropCycles.values()].filter((c) => {
        if (c.ownerId !== String(ownerId)) return false;
        if (filters.farmId && c.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && c.fieldId !== String(filters.fieldId)) return false;
        if (filters.crop && String(c.cropName).toLowerCase() !== String(filters.crop).toLowerCase()) return false;
        return true;
      });
    },
    async listAllCropCycles(ownerId, filters = {}) {
      return this.listCropCycles(ownerId, filters);
    },
    async listTasks(ownerId, filters = {}) {
      return [];
    },
    async listInventoryItems(ownerId, filters = {}) {
      return [];
    },
    async listFinanceRecords(ownerId, filters = {}) {
      return [...financeRecords.values()].filter((r) => {
        if (r.ownerId !== String(ownerId)) return false;
        if (filters.farmId && r.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && r.fieldId !== String(filters.fieldId)) return false;
        if (filters.type && r.type !== filters.type) return false;
        if (filters.startDate && new Date(r.date) < new Date(filters.startDate)) return false;
        if (filters.endDate && new Date(r.date) > new Date(filters.endDate)) return false;
        return true;
      });
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
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
        recordCount: records.length,
        categoryBreakdown,
      };
    },
    async createFinanceRecord(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const rec = { ...values, _id: newId(), ownerId: String(ownerId) };
      financeRecords.set(rec._id, rec);
      return { record: rec };
    },
    async updateFinanceRecord(ownerId, id, values) {
      const rec = financeRecords.get(String(id));
      if (!rec || rec.ownerId !== String(ownerId)) return null;
      Object.assign(rec, values);
      return { record: rec };
    },
    async deleteFinanceRecord(ownerId, id) {
      const rec = financeRecords.get(String(id));
      if (!rec || rec.ownerId !== String(ownerId)) return null;
      financeRecords.delete(String(id));
      return rec;
    },
    async getAnalyticsSummary(ownerId, filters = {}) {
      // Re-use standard calculation logic
      const farmsList = await this.listFarms(ownerId);
      const farmId = filters.farmId;
      const filteredFarms = farmId ? farmsList.filter((f) => String(f._id) === String(farmId)) : farmsList;

      let allFields = [];
      for (const f of filteredFarms) {
        const flds = await this.listFields(ownerId, f._id);
        allFields = allFields.concat(flds);
      }
      if (filters.fieldId) {
        allFields = allFields.filter((f) => String(f._id) === String(filters.fieldId));
      }

      const fieldMap = new Map(allFields.map((f) => [String(f._id), f]));
      const cycles = await this.listCropCycles(ownerId, filters);
      const completedCycles = cycles.filter((c) => c.status === 'completed');

      const normalizeToKg = (qty, unit) => {
        const n = Number(qty) || 0;
        const u = String(unit || 'kg').toLowerCase().trim();
        if (u === 'quintal' || u === 'quintals' || u === 'qtl') return n * 100;
        if (u === 'tonne' || u === 'tonnes' || u === 'ton' || u === 'tons' || u === 't' || u === 'mt') return n * 1000;
        if (u === 'g' || u === 'grams') return n / 1000;
        return n;
      };

      const cropProductionMap = new Map();
      let totalHarvestedKg = 0;
      for (const cycle of completedCycles) {
        if (cycle.yieldQuantity && Number(cycle.yieldQuantity) > 0) {
          const cropName = cycle.cropName || 'Other';
          const kg = normalizeToKg(cycle.yieldQuantity, cycle.yieldUnit);
          totalHarvestedKg += kg;
          if (!cropProductionMap.has(cropName)) {
            cropProductionMap.set(cropName, { cropName, totalKg: 0, harvestCount: 0 });
          }
          const e = cropProductionMap.get(cropName);
          e.totalKg += kg;
          e.harvestCount += 1;
        }
      }

      const fieldProductivityMap = new Map();
      let totalHarvestedKgWithArea = 0;
      let totalAreaWithHarvest = 0;
      for (const cycle of completedCycles) {
        if (cycle.yieldQuantity && Number(cycle.yieldQuantity) > 0) {
          const fld = cycle.fieldId ? fieldMap.get(String(cycle.fieldId)) : null;
          const area = fld ? Number(fld.areaHectares) || 0 : 0;
          const kg = normalizeToKg(cycle.yieldQuantity, cycle.yieldUnit);
          if (area > 0) {
            totalHarvestedKgWithArea += kg;
            totalAreaWithHarvest += area;
            fieldProductivityMap.set(String(cycle.fieldId), {
              fieldId: cycle.fieldId,
              fieldName: fld.name,
              areaHectares: area,
              totalKg: kg,
              yieldPerHectare: Math.round((kg / area) * 100) / 100,
            });
          }
        }
      }

      const finSummary = await this.getFinanceSummary(ownerId, filters);
      const totalRev = finSummary.totalIncome || 0;
      const totalExp = finSummary.totalExpense || 0;
      const netProfit = totalRev - totalExp;
      const profitMargin = totalRev > 0
        ? Math.round(((totalRev - totalExp) / totalRev) * 1000) / 10
        : (totalExp > 0 ? -100 : 0);

      const productivityKgPerHa = totalAreaWithHarvest > 0
        ? Math.round((totalHarvestedKgWithArea / totalAreaWithHarvest) * 100) / 100
        : null;

      return {
        farmCount: filteredFarms.length,
        fieldCount: allFields.length,
        cropProduction: Array.from(cropProductionMap.values()),
        fieldProductivity: Array.from(fieldProductivityMap.values()),
        summaryMetrics: {
          totalRevenue: totalRev,
          totalExpense: totalExp,
          netProfit,
          profitMargin,
          totalHarvestedKg,
          productivityKgPerHa,
        },
        finances: finSummary,
      };
    },
  };

  before(async () => {
    user1 = await mockUserStore.create({
      name: 'Ramesh Patel',
      email: 'ramesh@farms.in',
      password: 'password123',
      role: 'farmer',
    });
    user2 = await mockUserStore.create({
      name: 'Suresh Kumar',
      email: 'suresh@farms.in',
      password: 'password123',
      role: 'farmer',
    });

    const app = createApp({ userStore: mockUserStore, farmStore: mockFarmStore });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // Login user 1
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ramesh@farms.in', password: 'password123' }),
    });
    const data1 = await res1.json();
    token1 = data1.token;

    // Login user 2
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'suresh@farms.in', password: 'password123' }),
    });
    const data2 = await res2.json();
    token2 = data2.token;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('Empty Dataset: Returns zeroed metrics, empty arrays, and no zero-division exceptions', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.summaryMetrics.totalRevenue, 0);
    assert.equal(body.data.summaryMetrics.totalExpense, 0);
    assert.equal(body.data.summaryMetrics.netProfit, 0);
    assert.equal(body.data.summaryMetrics.profitMargin, 0);
    assert.equal(body.data.summaryMetrics.totalHarvestedKg, 0);
    assert.equal(body.data.summaryMetrics.productivityKgPerHa, null);
    assert.deepEqual(body.data.cropProduction, []);
    assert.deepEqual(body.data.fieldProductivity, []);
  });

  test('Financial Ledger CRUD: creates, updates, calculates profit, and isolates by owner', async () => {
    // 1. Create a Farm for User 1
    const farm1 = { _id: newId(), ownerId: user1._id, name: 'Green Valley Farm' };
    farms.set(farm1._id, farm1);

    // 2. Create Revenue Record
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
        amount: 85000,
        date: '2026-03-15',
        description: 'Sold 30 bags of wheat to mandi',
      }),
    });
    assert.equal(revRes.status, 201);
    const revRecord = (await revRes.json()).data;
    assert.equal(revRecord.amount, 85000);

    // 3. Create Expense Record
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
        amount: 25000,
        date: '2026-03-10',
        description: 'Purchased 15 bags DAP',
      }),
    });
    assert.equal(expRes.status, 201);
    const expRecord = (await expRes.json()).data;
    assert.equal(expRecord.amount, 25000);

    // 4. Update the Expense Record (edit amount to 30000)
    const updateRes = await fetch(`${baseUrl}/api/finances/${expRecord._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        amount: 30000,
        description: 'Purchased 15 bags DAP + Micronutrients',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updatedExp = (await updateRes.json()).data;
    assert.equal(updatedExp.amount, 30000);

    // 5. Verify Analytics Summary calculates revenue (85000), expense (30000), profit (55000)
    const summaryRes = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(summaryRes.status, 200);
    const summary = (await summaryRes.json()).data;
    assert.equal(summary.summaryMetrics.totalRevenue, 85000);
    assert.equal(summary.summaryMetrics.totalExpense, 30000);
    assert.equal(summary.summaryMetrics.netProfit, 55000);
    // Profit margin = (55000 / 85000) * 100 = 64.7%
    assert.equal(summary.summaryMetrics.profitMargin, 64.7);

    // 6. Cross-Owner Isolation: User 2 sees 0 revenue and 0 expenses
    const u2Res = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    const u2Summary = (await u2Res.json()).data;
    assert.equal(u2Summary.summaryMetrics.totalRevenue, 0);
    assert.equal(u2Summary.summaryMetrics.totalExpense, 0);
  });

  test('Unit Normalization & Field Productivity: accurately converts quintals/tonnes to kg and computes kg/ha', async () => {
    const farm = [...farms.values()][0];
    assert.ok(farm);

    // Field 1: 2 hectares
    const field1 = { _id: newId(), ownerId: user1._id, farmId: farm._id, name: 'North Parcel', areaHectares: 2 };
    fields.set(field1._id, field1);

    // Field 2: 1.5 hectares
    const field2 = { _id: newId(), ownerId: user1._id, farmId: farm._id, name: 'South Plot', areaHectares: 1.5 };
    fields.set(field2._id, field2);

    // Cycle 1: 20 Quintals Wheat on Field 1 -> 20 * 100 = 2,000 kg. Yield per ha = 2,000 / 2 = 1,000 kg/ha
    const cycle1 = {
      _id: newId(),
      ownerId: user1._id,
      farmId: farm._id,
      fieldId: field1._id,
      cropName: 'Wheat',
      yieldQuantity: 20,
      yieldUnit: 'quintal',
      status: 'completed',
    };
    cropCycles.set(cycle1._id, cycle1);

    // Cycle 2: 3 Tonnes Basmati on Field 2 -> 3 * 1000 = 3,000 kg. Yield per ha = 3,000 / 1.5 = 2,000 kg/ha
    const cycle2 = {
      _id: newId(),
      ownerId: user1._id,
      farmId: farm._id,
      fieldId: field2._id,
      cropName: 'Basmati Rice',
      yieldQuantity: 3,
      yieldUnit: 'tonne',
      status: 'completed',
    };
    cropCycles.set(cycle2._id, cycle2);

    // Request analytics summary
    const res = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data;

    // Total harvested production: 2,000 kg + 3,000 kg = 5,000 kg
    assert.equal(data.summaryMetrics.totalHarvestedKg, 5000);

    // Overall productivity: 5,000 kg / (2 + 1.5 ha) = 5000 / 3.5 = 1428.57 kg/ha
    assert.equal(data.summaryMetrics.productivityKgPerHa, 1428.57);

    // Crop production breakdown
    const wheat = data.cropProduction.find((c) => c.cropName === 'Wheat');
    assert.ok(wheat);
    assert.equal(wheat.totalKg, 2000);

    const rice = data.cropProduction.find((c) => c.cropName === 'Basmati Rice');
    assert.ok(rice);
    assert.equal(rice.totalKg, 3000);

    // Field productivity
    const fp1 = data.fieldProductivity.find((fp) => fp.fieldId === field1._id);
    assert.ok(fp1);
    assert.equal(fp1.yieldPerHectare, 1000);

    const fp2 = data.fieldProductivity.find((fp) => fp.fieldId === field2._id);
    assert.ok(fp2);
    assert.equal(fp2.yieldPerHectare, 2000);
  });
});
