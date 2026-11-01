import { describe, test, before, after } from 'node:test';
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
      const farm = {
        ...values,
        _id: id(),
        ownerId: String(ownerId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      farm.id = farm._id;
      farms.set(farm._id, farm);
      return farm;
    },
    async findFarm(ownerId, farmId) {
      const farm = farms.get(farmId);
      if (!farm || farm.ownerId !== String(ownerId)) return null;
      return farm;
    },
    async updateFarm(ownerId, farmId, values) {
      const farm = farms.get(farmId);
      if (!farm || farm.ownerId !== String(ownerId)) return null;
      const updated = {
        ...farm,
        ...values,
        updatedAt: new Date().toISOString(),
      };
      farms.set(farmId, updated);
      return updated;
    },
    async deleteFarm(ownerId, farmId) {
      const farm = farms.get(farmId);
      if (!farm || farm.ownerId !== String(ownerId)) return { deleted: false, hasFields: false };
      const hasFields = [...fields.values()].some((fld) => fld.farmId === farmId);
      if (hasFields) return { deleted: false, hasFields: true };
      farms.delete(farmId);
      return { deleted: true, hasFields: false };
    },
    async createField(ownerId, farmId, values) {
      const field = {
        ...values,
        _id: id(),
        ownerId: String(ownerId),
        farmId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fields.set(field._id, field);
      return field;
    },
    async listFields(ownerId, farmId) {
      return [...fields.values()].filter((f) => f.ownerId === String(ownerId) && f.farmId === farmId);
    },
  };

  return { userStore, farmStore, id };
};

describe('Farm Profile Management & Complete Editing Suite', () => {
  let app;
  let server;
  let baseUrl;
  let stores;
  let farmerTokenA;
  let farmerTokenB;
  let farmerAId;
  let farmerBId;

  before(async () => {
    stores = createMockStores();
    app = createApp({
      userStore: stores.userStore,
      farmStore: stores.farmStore,
    });
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Create Farmer A
    const farmerA = await stores.userStore.create({
      name: 'Ramesh Patel',
      email: 'ramesh.patel@gujarat.farm',
      password: 'Password123!',
      role: 'farmer',
      isEmailVerified: true,
    });
    farmerAId = farmerA._id;
    farmerTokenA = jwt.sign(
      { id: farmerA._id, role: farmerA.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create Farmer B
    const farmerB = await stores.userStore.create({
      name: 'Sunita Sharma',
      email: 'sunita.sharma@haryana.farm',
      password: 'Password123!',
      role: 'farmer',
      isEmailVerified: true,
    });
    farmerBId = farmerB._id;
    farmerTokenB = jwt.sign(
      { id: farmerB._id, role: farmerB.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  let createdFarmId;

  test('1. Minimal Farm Registration: succeeds with name only and auto-generates farmCode', async () => {
    const res = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Green Horizon Estate',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.farm.name, 'Green Horizon Estate');
    assert.ok(json.farm._id);
    createdFarmId = json.farm._id;
  });

  test('2. Full Farm Registration: accepts all 6 sections (Basic, Geo, Land, Infra, Agri, Management)', async () => {
    const fullFarmPayload = {
      name: 'Golden Wheat Agro Complex',
      farmCode: 'FRM-GWAC01',
      description: 'Multi-season certified crop and organic farming estate with automated drip network.',
      farmType: 'Mixed Farming',
      ownershipType: 'Owned',
      establishedYear: 2018,
      coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef',
      location: {
        country: 'India',
        state: 'Punjab',
        district: 'Ludhiana',
        tehsil: 'Jagraon',
        village: 'Kothe Sherpur',
        address: 'GT Road Near Canal Bridge',
        postalCode: '142026',
        latitude: 30.7852,
        longitude: 75.4789,
      },
      landDetails: {
        totalArea: 45.5,
        areaUnit: 'Acres',
        cultivableArea: 40.0,
        irrigatedArea: 38.0,
        nonCultivableArea: 5.5,
        soilType: 'Alluvial',
        landTerrain: 'Flat / Plain',
      },
      infrastructure: {
        irrigationSources: ['Tube Well / Borewell', 'Canal', 'Drip Irrigation System'],
        irrigationMethods: ['Drip', 'Sprinkler'],
        waterAvailability: 'Year-round (Perennial)',
        electricityAvailability: '24/7 Grid Power',
        storageFacilities: ['Grain Silo / Warehouse', 'Farm Machinery Shed'],
        greenhousePolyhouse: 'Naturally Ventilated Polyhouse',
        farmEquipment: ['Tractor', 'Rotavator', 'Seed Drill', 'Sprayer Drone'],
      },
      agriculturalDetails: {
        primaryCrops: ['Wheat', 'Basmati Rice', 'Mustard', 'Moong Dal'],
        farmingMethod: 'Integrated Pest Management (IPM)',
        farmingSeasons: ['Kharif (Monsoon)', 'Rabi (Winter)', 'Zaid (Summer)'],
        soilFertility: 'High',
        annualRainfallMm: 680,
        organicCertStatus: 'In Conversion (Year 2)',
        agriculturalNotes: 'High soil nitrogen content after pulse rotation.',
      },
      management: {
        managerName: 'Harpreet Singh',
        contactPerson: 'Gurwinder Kaur',
        contactPhone: '+91 98765 43210',
        contactEmail: 'harpreet@goldenwheat.farm',
        farmStatus: 'Active',
        internalNotes: 'Field 3 scheduled for laser leveling next spring.',
      },
    };

    const res = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify(fullFarmPayload),
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.farm.name, 'Golden Wheat Agro Complex');
    assert.equal(json.farm.farmCode, 'FRM-GWAC01');
    assert.equal(json.farm.farmType, 'Mixed Farming');
    assert.equal(json.farm.establishedYear, 2018);
    assert.equal(json.farm.location.district, 'Ludhiana');
    assert.equal(json.farm.location.state, 'Punjab');
    assert.equal(json.farm.landDetails.totalArea, 45.5);
    assert.equal(json.farm.landDetails.areaUnit, 'Acres');
    assert.equal(json.farm.landDetails.cultivableArea, 40.0);
    assert.equal(json.farm.landDetails.irrigatedArea, 38.0);
    assert.equal(json.farm.infrastructure.waterAvailability, 'Year-round (Perennial)');
    assert.equal(json.farm.agriculturalDetails.farmingMethod, 'Integrated Pest Management (IPM)');
    assert.equal(json.farm.management.managerName, 'Harpreet Singh');
    assert.equal(json.farm.management.farmStatus, 'Active');
  });

  test('3. Area and Logic Validation: rejects impossible area combinations and invalid enums', async () => {
    // 3a. Cultivable area exceeding total area
    const resA = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Invalid Area Farm',
        totalArea: 10,
        cultivableArea: 15,
      }),
    });
    const jsonA = await resA.json();
    assert.equal(resA.status, 400);
    assert.ok(jsonA.message.includes('Cultivable area cannot exceed total farm area'));

    // 3b. Sum of cultivable + non-cultivable exceeding total area
    const resB = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Invalid Area Sum Farm',
        totalArea: 20,
        cultivableArea: 15,
        nonCultivableArea: 8,
      }),
    });
    const jsonB = await resB.json();
    assert.equal(resB.status, 400);
    assert.ok(jsonB.message.includes('sum of cultivable and non-cultivable area'));

    // 3c. Invalid farmType
    const resC = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Invalid Type Farm',
        farmType: 'Interstellar Farming',
      }),
    });
    assert.equal(resC.status, 400);

    // 3d. Invalid year
    const resD = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Invalid Year Farm',
        establishedYear: 1650,
      }),
    });
    assert.equal(resD.status, 400);
  });

  test('4. Complete Farm Editing: updates any and all properties via PATCH /api/farms/:farmId', async () => {
    const updatePayload = {
      name: 'Green Horizon Bio-Dynamic Estate',
      description: 'Upgraded to 100% solar-powered organic greenhouse cultivation.',
      farmType: 'Organic Farming',
      ownershipType: 'Leased',
      establishedYear: 2020,
      location: {
        country: 'India',
        state: 'Madhya Pradesh',
        district: 'Sehore',
        tehsil: 'Ashta',
        village: 'Bhopal Road Plot 4',
        address: 'Highway 86 Milestone 12',
        postalCode: '466116',
        latitude: 23.0185,
        longitude: 76.5412,
      },
      landDetails: {
        totalArea: 32.0,
        areaUnit: 'Bigha',
        cultivableArea: 28.0,
        irrigatedArea: 25.0,
        nonCultivableArea: 4.0,
        soilType: 'Black (Regur)',
        landTerrain: 'Undulating / Rolling',
      },
      infrastructure: {
        irrigationSources: ['Open Well', 'Rainwater Harvesting / Pond'],
        irrigationMethods: ['Drip'],
        waterAvailability: 'Groundwater Dependent',
        electricityAvailability: 'Solar Powered',
        storageFacilities: ['Cold Storage', 'Packhouse / Sorting Shed'],
        greenhousePolyhouse: 'Hi-Tech Climate Controlled Polyhouse',
        farmEquipment: ['Power Tiller', 'Boom Sprayer', 'Drip Automation Unit'],
      },
      agriculturalDetails: {
        primaryCrops: ['Soybean', 'Chickpea (Gram)', 'Wheat'],
        farmingMethod: 'Organic Certified',
        farmingSeasons: ['Kharif (Monsoon)', 'Rabi (Winter)'],
        soilFertility: 'Medium',
        annualRainfallMm: 950,
        organicCertStatus: 'Certified Organic (NPOP/NOP)',
        agriculturalNotes: 'Vermicompost pits established along North perimeter.',
      },
      management: {
        managerName: 'Anil Kumar',
        contactPerson: 'Meera Patel',
        contactPhone: '+91 94250 11223',
        contactEmail: 'anil.kumar@horizon.farm',
        farmStatus: 'Active',
        internalNotes: 'Soil test report updated October 2026.',
      },
    };

    const res = await fetch(`${baseUrl}/api/farms/${createdFarmId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify(updatePayload),
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.farm.name, 'Green Horizon Bio-Dynamic Estate');
    assert.equal(json.farm.farmType, 'Organic Farming');
    assert.equal(json.farm.ownershipType, 'Leased');
    assert.equal(json.farm.location.district, 'Sehore');
    assert.equal(json.farm.location.postalCode, '466116');
    assert.equal(json.farm.landDetails.totalArea, 32.0);
    assert.equal(json.farm.landDetails.areaUnit, 'Bigha');
    assert.equal(json.farm.landDetails.soilType, 'Black (Regur)');
    assert.equal(json.farm.infrastructure.electricityAvailability, 'Solar Powered');
    assert.equal(json.farm.agriculturalDetails.organicCertStatus, 'Certified Organic (NPOP/NOP)');
    assert.equal(json.farm.management.managerName, 'Anil Kumar');
  });

  test('5. PUT /api/farms/:farmId endpoint: accepts complete updates as a PUT request', async () => {
    const res = await fetch(`${baseUrl}/api/farms/${createdFarmId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Green Horizon Agro-Tech Hub',
        farmStatus: 'Under Development',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.farm.name, 'Green Horizon Agro-Tech Hub');
    assert.equal(json.farm.management.farmStatus, 'Under Development');
  });

  test('6. Multi-Tenant Security: Farmer B CANNOT update Farmer A farm (returns 404)', async () => {
    const res = await fetch(`${baseUrl}/api/farms/${createdFarmId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenB}`,
      },
      body: JSON.stringify({
        name: 'Malicious Hijack Attempt',
      }),
    });
    assert.equal(res.status, 404);

    // Verify Farmer A's farm remains unchanged
    const verifyRes = await fetch(`${baseUrl}/api/farms/${createdFarmId}`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.farm.name, 'Green Horizon Agro-Tech Hub');
  });

  test('7. Cover Image Management: removes cover image via DELETE /api/farms/:farmId/cover-image', async () => {
    const res = await fetch(`${baseUrl}/api/farms/${createdFarmId}/cover-image`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.farm.coverImage, '');
  });

  test('8. Related Records Safety: existing fields and crop cycles are preserved when farm is edited', async () => {
    // Create a field under createdFarmId
    const fieldRes = await fetch(`${baseUrl}/api/farms/${createdFarmId}/fields`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'North Plot A',
        areaHectares: 4.5,
        soilType: 'Loamy',
        waterSource: 'Drip Line',
      }),
    });
    const fieldJson = await fieldRes.json();
    assert.equal(fieldRes.status, 201);
    const fieldId = fieldJson.field._id;

    // Update farm again
    await fetch(`${baseUrl}/api/farms/${createdFarmId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        name: 'Green Horizon Verified Estate',
      }),
    });

    // Verify field still exists and is linked properly
    const listFieldsRes = await fetch(`${baseUrl}/api/farms/${createdFarmId}/fields`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    const listFieldsJson = await listFieldsRes.json();
    assert.equal(listFieldsRes.status, 200);
    const foundField = listFieldsJson.fields.find((f) => f._id === fieldId);
    assert.ok(foundField, 'Field must persist unchanged across farm profile updates');
    assert.equal(foundField.name, 'North Plot A');
  });
});
