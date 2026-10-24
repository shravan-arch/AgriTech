import '../config/env.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../config/db.js';

import User from '../models/User.js';
import Farm from '../models/Farm.js';
import Field from '../models/Field.js';
import CropCycle from '../models/CropCycle.js';
import FarmActivity from '../models/FarmActivity.js';
import Task from '../models/Task.js';
import FinanceRecord from '../models/FinanceRecord.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryMovement from '../models/InventoryMovement.js';
import Sensor from '../models/Sensor.js';
import SensorReading from '../models/SensorReading.js';
import FieldPhoto from '../models/FieldPhoto.js';
import WeatherSnapshot from '../models/WeatherSnapshot.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

export const seedDatabase = async () => {
  console.log('[Seed] Connecting to MongoDB Atlas...');
  await connectDB();

  console.log('[Seed] Deleting existing database collections and demo records...');
  await Promise.all([
    User.deleteMany({}),
    Farm.deleteMany({}),
    Field.deleteMany({}),
    CropCycle.deleteMany({}),
    FarmActivity.deleteMany({}),
    Task.deleteMany({}),
    FinanceRecord.deleteMany({}),
    InventoryItem.deleteMany({}),
    InventoryMovement.deleteMany({}),
    Sensor.deleteMany({}),
    SensorReading.deleteMany({}),
    FieldPhoto.deleteMany({}),
    WeatherSnapshot.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log('[Seed] Database wiped clean.');

  // ==========================================
  // 1. ADMIN ACCOUNT
  // ==========================================
  const adminUser = await User.create({
    name: 'Shravan Chhabra',
    email: 'shravanchhabra777@gmail.com',
    password: 'Shravan@4546',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    language: 'en',
    phone: '+91 98765 43210',
    address: 'PAU Campus, Ferozepur Road, Ludhiana, Punjab - 141004, India',
    farmName: 'PAU Experimental Agricultural Station',
    farmSizeHectares: 20.7,
    primaryCrops: ['Wheat', 'Basmati Rice', 'Mustard'],
    location: {
      region: 'Punjab',
      country: 'India',
    },
  });

  console.log(`[Seed] Created Administrator: ${adminUser.email} (${adminUser._id})`);

  // Admin Farms (2 farms, 2 fields each)
  const adminFarm1 = await Farm.create({
    ownerId: adminUser._id,
    name: 'Punjab Agricultural University Research Farm',
    location: {
      region: 'Punjab',
      country: 'India',
      city: 'Ludhiana',
      latitude: 30.9010,
      longitude: 75.8070,
    },
  });

  const adminField1_1 = await Field.create({
    ownerId: adminUser._id,
    farmId: adminFarm1._id,
    name: 'Kalyan Sona Wheat Agronomy Parcel',
    areaHectares: 12.5,
    soilType: 'Alluvial Soil',
    waterSource: 'Canal & Tube-well',
    irrigationDetails: 'Surface flooding & underground pressurized pipeline',
    coordinates: { latitude: 30.9015, longitude: 75.8075 },
  });

  const adminField1_2 = await Field.create({
    ownerId: adminUser._id,
    farmId: adminFarm1._id,
    name: 'Basmati Rice Cultivar Trial Block',
    areaHectares: 8.2,
    soilType: 'Alluvial Soil',
    waterSource: 'Canal & Automated Drip',
    irrigationDetails: 'Sub-surface drip & shallow flood checks',
    coordinates: { latitude: 30.9005, longitude: 75.8065 },
  });

  const adminFarm2 = await Farm.create({
    ownerId: adminUser._id,
    name: 'Haryana Central Agricultural Research Station',
    location: {
      region: 'Haryana',
      country: 'India',
      city: 'Karnal',
      latitude: 29.6857,
      longitude: 76.9907,
    },
  });

  const adminField2_1 = await Field.create({
    ownerId: adminUser._id,
    farmId: adminFarm2._id,
    name: 'Karnal Mustard Evaluation Field',
    areaHectares: 6.0,
    soilType: 'Alluvial Soil',
    waterSource: 'Deep Borewell (Solar)',
    irrigationDetails: 'Micro-sprinkler system',
    coordinates: { latitude: 29.6860, longitude: 76.9912 },
  });

  const adminField2_2 = await Field.create({
    ownerId: adminUser._id,
    farmId: adminFarm2._id,
    name: 'Taraori Basmati Experimental Plot',
    areaHectares: 10.5,
    soilType: 'Alluvial Soil',
    waterSource: 'Western Yamuna Canal Branch',
    irrigationDetails: 'Precision furrow irrigation',
    coordinates: { latitude: 29.6850, longitude: 76.9900 },
  });

  // Admin Crops
  const adminCycle1 = await CropCycle.create({
    ownerId: adminUser._id,
    farmId: adminFarm1._id,
    fieldId: adminField1_1._id,
    cropName: 'Wheat',
    variety: 'PBW-824 Certified',
    season: 'Rabi 2026',
    plantingDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    expectedHarvestDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
    stage: 'vegetative',
    status: 'active',
    notes: 'Optimal tillering observed with balanced nitrogen dosage.',
  });

  const adminCycle2 = await CropCycle.create({
    ownerId: adminUser._id,
    farmId: adminFarm2._id,
    fieldId: adminField2_1._id,
    cropName: 'Mustard',
    variety: 'Pusa Bold / RH-749',
    season: 'Rabi 2026',
    plantingDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    expectedHarvestDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    stage: 'flowering',
    status: 'active',
    notes: 'Flowering stage reached; bee pollinator activity high.',
  });

  // Admin Operational Tasks
  await Task.create([
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      fieldId: adminField1_1._id,
      cropCycleId: adminCycle1._id,
      title: 'First top-dressing of urea & zinc booster',
      type: 'fertilizer',
      priority: 'high',
      status: 'pending',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      notes: 'Apply after canal irrigation cycle settles.',
      assignee: 'Agronomy Field Team',
    },
    {
      ownerId: adminUser._id,
      farmId: adminFarm2._id,
      fieldId: adminField2_1._id,
      cropCycleId: adminCycle2._id,
      title: 'Inspect mustard aphid threshold markers',
      type: 'inspection',
      priority: 'medium',
      status: 'pending',
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      notes: 'Yellow sticky traps check across North-East boundary.',
      assignee: 'Crop Protection Wing',
    },
  ]);

  // Admin Finances
  await FinanceRecord.create([
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      fieldId: adminField1_1._id,
      cropCycleId: adminCycle1._id,
      type: 'expense',
      category: 'seeds',
      amount: 14500,
      currency: 'INR',
      date: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000),
      description: 'Foundation Wheat Seed PBW-824 (500 kg)',
    },
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      fieldId: adminField1_1._id,
      cropCycleId: adminCycle1._id,
      type: 'expense',
      category: 'fertilizer',
      amount: 18200,
      currency: 'INR',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      description: 'DAP & Potassium Schoenite soil conditioning',
    },
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      fieldId: adminField1_2._id,
      type: 'revenue',
      category: 'harvest_sale',
      amount: 148000,
      currency: 'INR',
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      description: 'Seed multiplication grain procurement by National Seeds Corp',
    },
  ]);

  // Admin Inventory
  await InventoryItem.create([
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      name: 'Certified PBW-824 Wheat Seed Bags',
      category: 'seeds',
      quantity: 45,
      unit: 'bags',
      minThreshold: 10,
      costPerUnit: 1200,
      location: 'Central Grain Seed Shed B',
    },
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      name: 'Water Soluble NPK 19:19:19',
      category: 'fertilizer',
      quantity: 80,
      unit: 'bags',
      minThreshold: 15,
      costPerUnit: 1850,
      location: 'Nutrient Storage Bay 1',
    },
    {
      ownerId: adminUser._id,
      farmId: adminFarm2._id,
      name: 'Bio-Neem Organic Repellent 10000 PPM',
      category: 'chemical',
      quantity: 35,
      unit: 'liters',
      minThreshold: 8,
      costPerUnit: 420,
      location: 'Karnal Chemical Lockbox',
    },
  ]);

  // Admin Sensors (Real Physical Ingestion Sensors)
  await Sensor.create([
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      fieldId: adminField1_1._id,
      name: 'PAU Rootzone Soil Moisture Station Alpha',
      type: 'soil_moisture',
      deviceUid: 'PAU-SOIL-LUD-01',
      status: 'active',
      batteryLevel: 96,
      thresholds: { min: 25, max: 75, unit: '%' },
      isSimulated: false,
      source: 'physical',
      lastReadingAt: new Date(),
    },
    {
      ownerId: adminUser._id,
      farmId: adminFarm1._id,
      fieldId: adminField1_1._id,
      name: 'PAU Agronomy Soil Temp Probe 1',
      type: 'soil_temperature',
      deviceUid: 'PAU-STEMP-LUD-02',
      status: 'active',
      batteryLevel: 98,
      thresholds: { min: 14, max: 32, unit: '°C' },
      isSimulated: false,
      source: 'physical',
      lastReadingAt: new Date(),
    },
  ]);

  // ==========================================
  // 2. SIX REALISTIC USER ACCOUNTS (2 Farms & 2 Fields each = 12 Farms, 24 Fields)
  // ==========================================
  const demoUsersConfig = [
    {
      name: 'Gurpreet Singh',
      email: 'gurpreet.singh@agritech.org',
      passwordPlain: 'Gurpreet@2026!',
      phone: '+91 98140 12345',
      address: 'Village Chahar, Near Moga Bypass, Moga District, Punjab - 142001, India',
      language: 'pa',
      farms: [
        {
          name: 'Malwa Grain Valley Farm',
          city: 'Moga',
          region: 'Punjab',
          country: 'India',
          latitude: 30.8165,
          longitude: 75.1715,
          fields: [
            {
              name: 'Chahar Wheat Parcel',
              areaHectares: 14.5,
              soilType: 'Alluvial Soil',
              waterSource: 'Tube-well Bore',
              irrigationDetails: 'Submersible 15HP tube-well connected to laser-leveled flood checks',
              coordinates: { latitude: 30.8170, longitude: 75.1720 },
              crop: { name: 'Wheat', variety: 'HD-3086', stage: 'vegetative', season: 'Rabi 2026', ageDays: 42 },
            },
            {
              name: 'GT Road Corn & Fodder Field',
              areaHectares: 9.0,
              soilType: 'Alluvial Soil',
              waterSource: 'Canal Irrigation',
              irrigationDetails: 'Sirhind Canal distributary branch with lined concrete channel',
              coordinates: { latitude: 30.8160, longitude: 75.1710 },
              crop: { name: 'Maize', variety: 'Pioneer P3396', stage: 'vegetative', season: 'Kharif/Rabi', ageDays: 28 },
            },
          ],
        },
        {
          name: 'Doaba Agro Orchard & Field',
          city: 'Hoshiarpur',
          region: 'Punjab',
          country: 'India',
          latitude: 31.5273,
          longitude: 75.9143,
          fields: [
            {
              name: 'Kandi Sub-Himalayan Plot',
              areaHectares: 7.8,
              soilType: 'Sandy Loam Soil',
              waterSource: 'Rainfed & Drip',
              irrigationDetails: 'Rainwater harvesting check-dam with booster pump drip system',
              coordinates: { latitude: 31.5280, longitude: 75.9150 },
              crop: { name: 'Mustard', variety: 'Giriraj', stage: 'flowering', season: 'Rabi 2026', ageDays: 38 },
            },
            {
              name: 'Citrus & Sugarcane Enclosure',
              areaHectares: 11.2,
              soilType: 'Alluvial Soil',
              waterSource: 'Deep Tube-well',
              irrigationDetails: 'Micro-jet drip emitters along fruit tree lines',
              coordinates: { latitude: 31.5265, longitude: 75.9135 },
              crop: { name: 'Sugarcane', variety: 'CoJ-85', stage: 'vegetative', season: 'Annual 2026', ageDays: 80 },
            },
          ],
        },
      ],
    },
    {
      name: 'Rajesh Patil',
      email: 'rajesh.patil@agritech.org',
      passwordPlain: 'Rajesh@2026!',
      phone: '+91 98220 54321',
      address: 'Hinganghat Road, Wardha, Maharashtra - 442001, India',
      language: 'mr',
      farms: [
        {
          name: 'Deccan Black Soil Cotton Estate',
          city: 'Wardha',
          region: 'Maharashtra',
          country: 'India',
          latitude: 20.7453,
          longitude: 78.6022,
          fields: [
            {
              name: 'Hinganghat Cotton Parcel',
              areaHectares: 15.0,
              soilType: 'Black Cotton Soil',
              waterSource: 'Farm Pond & Automated Drip',
              irrigationDetails: 'Solar powered drip fertigation with soil tension sensors',
              coordinates: { latitude: 20.7458, longitude: 78.6028 },
              crop: { name: 'Cotton', variety: 'Bollgard II RCH-659', stage: 'flowering', season: 'Kharif/Post-Monsoon', ageDays: 70 },
            },
            {
              name: 'Sewagram Soybean Terraces',
              areaHectares: 10.0,
              soilType: 'Black Cotton Soil',
              waterSource: 'Borewell',
              irrigationDetails: 'Overhead impact sprinkler network',
              coordinates: { latitude: 20.7448, longitude: 78.6015 },
              crop: { name: 'Soybean', variety: 'JS-335 Certified', stage: 'ripening', season: 'Late Kharif', ageDays: 88 },
            },
          ],
        },
        {
          name: 'Nashik Valley Horticulture Farm',
          city: 'Nashik',
          region: 'Maharashtra',
          country: 'India',
          latitude: 20.1472,
          longitude: 74.2250,
          fields: [
            {
              name: 'Godavari Onion Basin',
              areaHectares: 8.5,
              soilType: 'Medium Black Soil',
              waterSource: 'Canal Lift',
              irrigationDetails: 'Broad bed and furrow (BBF) with drip lines',
              coordinates: { latitude: 20.1478, longitude: 74.2255 },
              crop: { name: 'Onion', variety: 'Bhima Super (Red Nasik)', stage: 'vegetative', season: 'Rabi 2026', ageDays: 32 },
            },
            {
              name: 'Niphad Table Grape Vineyard',
              areaHectares: 5.5,
              soilType: 'Red & Yellow Soil',
              waterSource: 'Borewell & Drip',
              irrigationDetails: 'Trellis mounted automated pulse drip emitters',
              coordinates: { latitude: 20.1465, longitude: 74.2242 },
              crop: { name: 'Grapes', variety: 'Thompson Seedless', stage: 'fruiting', season: 'Perennial', ageDays: 120 },
            },
          ],
        },
      ],
    },
    {
      name: 'Ananya Reddy',
      email: 'ananya.reddy@agritech.org',
      passwordPlain: 'Ananya@2026!',
      phone: '+91 94400 98765',
      address: 'Canal Bank Road, Tenali, Guntur District, Andhra Pradesh - 522201, India',
      language: 'te',
      farms: [
        {
          name: 'Krishna Delta Rice Station',
          city: 'Tenali',
          region: 'Andhra Pradesh',
          country: 'India',
          latitude: 16.2430,
          longitude: 80.6400,
          fields: [
            {
              name: 'Tenali Canal Paddy Field',
              areaHectares: 12.0,
              soilType: 'Alluvial Soil',
              waterSource: 'Krishna Delta Canal',
              irrigationDetails: 'Gravity flow field-to-field controlled sluice gates',
              coordinates: { latitude: 16.2435, longitude: 80.6405 },
              crop: { name: 'Paddy (Basmati)', variety: 'BPT 5204 (Samba Mahsuri)', stage: 'vegetative', season: 'Rabi 2026', ageDays: 40 },
            },
            {
              name: 'Guntur Red Chilli Acres',
              areaHectares: 6.5,
              soilType: 'Black Cotton Soil',
              waterSource: 'Borewell',
              irrigationDetails: 'Silver-black plastic mulch with double lateral drip lines',
              coordinates: { latitude: 16.2425, longitude: 80.6395 },
              crop: { name: 'Chilli', variety: 'Teja S17', stage: 'flowering', season: 'Annual 2026', ageDays: 55 },
            },
          ],
        },
        {
          name: 'Telangana Semi-Arid Millet Farm',
          city: 'Warangal',
          region: 'Telangana',
          country: 'India',
          latitude: 17.9689,
          longitude: 79.5941,
          fields: [
            {
              name: 'Kakatiya Sorghum & Bajra Plot',
              areaHectares: 9.5,
              soilType: 'Red & Yellow Soil',
              waterSource: 'Rainfed & Tank',
              irrigationDetails: 'Farm irrigation pond fed supplementary sprinkler sets',
              coordinates: { latitude: 17.9695, longitude: 79.5948 },
              crop: { name: 'Sorghum', variety: 'CSH-16', stage: 'vegetative', season: 'Rabi 2026', ageDays: 30 },
            },
            {
              name: 'Palampet Hybrid Maize Field',
              areaHectares: 8.0,
              soilType: 'Red Sandy Loam',
              waterSource: 'Borewell',
              irrigationDetails: 'Inline pressure-compensating drip system',
              coordinates: { latitude: 17.9682, longitude: 79.5935 },
              crop: { name: 'Maize', variety: 'DHM-117', stage: 'germination', season: 'Rabi 2026', ageDays: 14 },
            },
          ],
        },
      ],
    },
    {
      name: 'Vikram Rathore',
      email: 'vikram.rathore@agritech.org',
      passwordPlain: 'Vikram@2026!',
      phone: '+91 97840 45678',
      address: 'Degana Road, Nagaur, Rajasthan - 341001, India',
      language: 'hi',
      farms: [
        {
          name: 'Marwar Mustard & Cumin Ranch',
          city: 'Nagaur',
          region: 'Rajasthan',
          country: 'India',
          latitude: 27.1983,
          longitude: 73.7493,
          fields: [
            {
              name: 'Thar Cumin & Fenugreek Field',
              areaHectares: 18.0,
              soilType: 'Desert / Arid Soil',
              waterSource: 'Deep Tube-well (Solar)',
              irrigationDetails: 'High-efficiency micro-sprinkler misting network',
              coordinates: { latitude: 27.1990, longitude: 73.7500 },
              crop: { name: 'Cumin', variety: 'Gujarat Cumin-4', stage: 'vegetative', season: 'Rabi 2026', ageDays: 35 },
            },
            {
              name: 'Nagaur Mustard Dryland',
              areaHectares: 12.0,
              soilType: 'Sandy Loam Soil',
              waterSource: 'Borewell',
              irrigationDetails: 'Alternate row drip irrigation for moisture conservation',
              coordinates: { latitude: 27.1975, longitude: 73.7485 },
              crop: { name: 'Mustard', variety: 'Laxmi (RH-8812)', stage: 'flowering', season: 'Rabi 2026', ageDays: 48 },
            },
          ],
        },
        {
          name: 'Saurashtra Groundnut Plantation',
          city: 'Junagadh',
          region: 'Gujarat',
          country: 'India',
          latitude: 21.5222,
          longitude: 70.4579,
          fields: [
            {
              name: 'Gir Foothills Groundnut Block',
              areaHectares: 11.0,
              soilType: 'Medium Black Soil',
              waterSource: 'Open Dug Well',
              irrigationDetails: 'Electric pump furrow irrigation with micro-channels',
              coordinates: { latitude: 21.5228, longitude: 70.4585 },
              crop: { name: 'Groundnut', variety: 'GG-20 (Girnar)', stage: 'vegetative', season: 'Summer Crop', ageDays: 22 },
            },
            {
              name: 'Coastal Sesame & Castor Field',
              areaHectares: 7.5,
              soilType: 'Alluvial Soil',
              waterSource: 'Borewell',
              irrigationDetails: 'Drip lines with hydrocyclone sand filter system',
              coordinates: { latitude: 21.5215, longitude: 70.4572 },
              crop: { name: 'Cotton', variety: 'G.Cot.23', stage: 'vegetative', season: 'Rabi/Summer', ageDays: 26 },
            },
          ],
        },
      ],
    },
    {
      name: 'Rameshwar Sharma',
      email: 'rameshwar.sharma@agritech.org',
      passwordPlain: 'Rameshwar@2026!',
      phone: '+91 98260 11223',
      address: 'Dewas Road, Ujjain, Madhya Pradesh - 456010, India',
      language: 'hi',
      farms: [
        {
          name: 'Malwa Plateau Soybean Heartland',
          city: 'Ujjain',
          region: 'Madhya Pradesh',
          country: 'India',
          latitude: 23.1765,
          longitude: 75.7885,
          fields: [
            {
              name: 'Shipra Valley Soybean Parcel',
              areaHectares: 16.0,
              soilType: 'Black Cotton Soil',
              waterSource: 'Check Dam & Tube-well',
              irrigationDetails: 'Perforated rain pipe and sprinkler system',
              coordinates: { latitude: 23.1770, longitude: 75.7890 },
              crop: { name: 'Soybean', variety: 'NRC-127 (Ahilya)', stage: 'flowering', season: 'Post-Kharif', ageDays: 52 },
            },
            {
              name: 'Shajapur Durum Wheat Strip',
              areaHectares: 13.5,
              soilType: 'Black Cotton Soil',
              waterSource: 'Canal Supply',
              irrigationDetails: 'Narmada-Kshipra link pipeline gravity outlet',
              coordinates: { latitude: 23.1760, longitude: 75.7880 },
              crop: { name: 'Wheat', variety: 'HI-8759 (Pusa Tejas Durum)', stage: 'vegetative', season: 'Rabi 2026', ageDays: 36 },
            },
          ],
        },
        {
          name: 'Narmada Valley Pulses Farm',
          city: 'Narmadapuram',
          region: 'Madhya Pradesh',
          country: 'India',
          latitude: 22.7519,
          longitude: 77.7289,
          fields: [
            {
              name: 'Narmada Chickpea & Gram Field',
              areaHectares: 10.0,
              soilType: 'Alluvial Soil',
              waterSource: 'River Lift Irrigation',
              irrigationDetails: 'Electric river pump station with underground distribution pipeline',
              coordinates: { latitude: 22.7525, longitude: 77.7295 },
              crop: { name: 'Chickpea', variety: 'JG-16 (Desi Chana)', stage: 'flowering', season: 'Rabi 2026', ageDays: 45 },
            },
            {
              name: 'Tawa Canal Moong & Lentil Plot',
              areaHectares: 8.0,
              soilType: 'Loamy Soil',
              waterSource: 'Tawa Left Bank Canal',
              irrigationDetails: 'Lined field watercourses with corrugated PVC pipes',
              coordinates: { latitude: 22.7512, longitude: 77.7282 },
              crop: { name: 'Lentil', variety: 'JL-3', stage: 'vegetative', season: 'Rabi 2026', ageDays: 30 },
            },
          ],
        },
      ],
    },
    {
      name: 'Suresh Kumar',
      email: 'suresh.kumar@agritech.org',
      passwordPlain: 'Suresh@2026!',
      phone: '+91 94480 33445',
      address: 'Sugar Town Post, Mandya, Karnataka - 571401, India',
      language: 'kn',
      farms: [
        {
          name: 'Cauvery Basin Sugarcane Estate',
          city: 'Mandya',
          region: 'Karnataka',
          country: 'India',
          latitude: 12.5218,
          longitude: 76.8951,
          fields: [
            {
              name: 'Sugar Town Cane Fields',
              areaHectares: 14.0,
              soilType: 'Red & Yellow Soil',
              waterSource: 'KRS Visvesvaraya Canal',
              irrigationDetails: 'Alternating furrow irrigation fed by Visvesvaraya Canal distributary',
              coordinates: { latitude: 12.5224, longitude: 76.8958 },
              crop: { name: 'Sugarcane', variety: 'Co-86032 (Nayana)', stage: 'vegetative', season: 'Annual 2026', ageDays: 95 },
            },
            {
              name: 'Maddur Ragi Millet Block',
              areaHectares: 6.5,
              soilType: 'Red Loam Soil',
              waterSource: 'Borewell',
              irrigationDetails: 'Micro-sprinkler system for finger millet beds',
              coordinates: { latitude: 12.5212, longitude: 76.8945 },
              crop: { name: 'Ragi (Finger Millet)', variety: 'GPU-28', stage: 'flowering', season: 'Rabi 2026', ageDays: 46 },
            },
          ],
        },
        {
          name: 'Pollachi Coconut & Spice Estate',
          city: 'Pollachi',
          region: 'Tamil Nadu',
          country: 'India',
          latitude: 10.6583,
          longitude: 77.0084,
          fields: [
            {
              name: 'Pollachi Coconut & Cocoa Grove',
              areaHectares: 9.0,
              soilType: 'Red & Yellow Soil',
              waterSource: 'Aliyar River Canal & Wells',
              irrigationDetails: 'Multi-tier drip irrigation catering to coconut and understory cocoa',
              coordinates: { latitude: 10.6589, longitude: 77.0090 },
              crop: { name: 'Coconut', variety: 'West Coast Tall & Dwarf', stage: 'fruiting', season: 'Perennial', ageDays: 365 },
            },
            {
              name: 'Annamalai Turmeric Parcel',
              areaHectares: 5.0,
              soilType: 'Laterite Soil',
              waterSource: 'Open Well',
              irrigationDetails: 'Raised bed drip with organic coir pith mulching',
              coordinates: { latitude: 10.6576, longitude: 77.0078 },
              crop: { name: 'Turmeric', variety: 'Prathiba High Curcumin', stage: 'ripening', season: 'Annual 2026', ageDays: 140 },
            },
          ],
        },
      ],
    },
  ];

  const allSeededUsers = [adminUser];
  const allSeededFarms = [adminFarm1, adminFarm2];
  const allSeededFields = [adminField1_1, adminField1_2, adminField2_1, adminField2_2];
  const allSeededCycles = [adminCycle1, adminCycle2];
  const allSeededTasks = [];
  const allSeededActivities = [];
  const allSeededFinances = [];
  const allSeededInventory = [];
  const allSeededSensors = [];

  for (const userConf of demoUsersConfig) {
    const userDoc = await User.create({
      name: userConf.name,
      email: userConf.email,
      password: userConf.passwordPlain,
      role: 'farmer',
      status: 'active',
      emailVerified: true,
      language: userConf.language || 'en',
      phone: userConf.phone,
      address: userConf.address,
      farmName: userConf.farms[0]?.name,
      farmSizeHectares: userConf.farms.reduce((acc, f) => acc + f.fields.reduce((a2, fld) => a2 + fld.areaHectares, 0), 0),
      primaryCrops: userConf.farms.flatMap((f) => f.fields.map((fld) => fld.crop?.name)).filter(Boolean),
      location: {
        region: userConf.farms[0]?.region,
        country: userConf.farms[0]?.country,
      },
    });

    allSeededUsers.push(userDoc);
    console.log(`[Seed] Created User: ${userDoc.email} (${userDoc.name})`);

    for (const farmConf of userConf.farms) {
      const farmDoc = await Farm.create({
        ownerId: userDoc._id,
        name: farmConf.name,
        location: {
          region: farmConf.region,
          country: farmConf.country,
          city: farmConf.city,
          latitude: farmConf.latitude,
          longitude: farmConf.longitude,
        },
      });

      allSeededFarms.push(farmDoc);

      for (const fieldConf of farmConf.fields) {
        const fieldDoc = await Field.create({
          ownerId: userDoc._id,
          farmId: farmDoc._id,
          name: fieldConf.name,
          areaHectares: fieldConf.areaHectares,
          soilType: fieldConf.soilType,
          waterSource: fieldConf.waterSource,
          irrigationDetails: fieldConf.irrigationDetails,
          coordinates: fieldConf.coordinates,
        });

        allSeededFields.push(fieldDoc);

        // Active Crop Cycle
        if (fieldConf.crop) {
          const plantingDate = new Date(Date.now() - fieldConf.crop.ageDays * 24 * 60 * 60 * 1000);
          const cycleDoc = await CropCycle.create({
            ownerId: userDoc._id,
            farmId: farmDoc._id,
            fieldId: fieldDoc._id,
            cropName: fieldConf.crop.name,
            variety: fieldConf.crop.variety,
            season: fieldConf.crop.season,
            plantingDate,
            expectedHarvestDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            stage: fieldConf.crop.stage,
            status: 'active',
            notes: `Field healthy. Soil type: ${fieldConf.soilType}. Irrigation via ${fieldConf.waterSource}.`,
          });
          allSeededCycles.push(cycleDoc);

          // Operational Task
          const taskDoc = await Task.create({
            ownerId: userDoc._id,
            farmId: farmDoc._id,
            fieldId: fieldDoc._id,
            cropCycleId: cycleDoc._id,
            title: `Irrigation & soil check for ${fieldConf.crop.name}`,
            type: 'irrigation',
            priority: 'medium',
            status: 'pending',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            notes: `Check soil moisture and ensure ${fieldConf.waterSource} lines are operating normally.`,
            assignee: userConf.name,
          });
          allSeededTasks.push(taskDoc);

          // Recent Activity
          const actDoc = await FarmActivity.create({
            ownerId: userDoc._id,
            farmId: farmDoc._id,
            fieldId: fieldDoc._id,
            cropCycleId: cycleDoc._id,
            type: 'irrigation',
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            notes: `Scheduled irrigation run completed across ${fieldConf.areaHectares} hectares.`,
            performedBy: userConf.name,
          });
          allSeededActivities.push(actDoc);

          // Finance record
          const finDoc = await FinanceRecord.create({
            ownerId: userDoc._id,
            farmId: farmDoc._id,
            fieldId: fieldDoc._id,
            cropCycleId: cycleDoc._id,
            type: 'expense',
            category: 'seeds',
            amount: Math.round(fieldConf.areaHectares * 1150),
            currency: 'INR',
            date: plantingDate,
            description: `Certified Seed: ${fieldConf.crop.name} (${fieldConf.crop.variety})`,
          });
          allSeededFinances.push(finDoc);
        }

        // Real Field Sensor (Physical)
        const sensorCode = String(farmDoc.location.city || 'AGR').toUpperCase().slice(0, 3);
        const sensorDoc = await Sensor.create({
          ownerId: userDoc._id,
          farmId: farmDoc._id,
          fieldId: fieldDoc._id,
          name: `${fieldConf.name.split(' ')[0]} Field Sensor Array`,
          type: 'soil_moisture',
          deviceUid: `SN-${sensorCode}-${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'active',
          batteryLevel: 94 + Math.floor(Math.random() * 6),
          thresholds: { min: 25, max: 70, unit: '%' },
          isSimulated: false,
          source: 'physical',
          lastReadingAt: new Date(),
        });
        allSeededSensors.push(sensorDoc);
      }
    }
  }

  // ==========================================
  // 3. AUDIT LOG INITIALIZATION
  // ==========================================
  await AuditLog.create({
    action: 'ADMIN_BOOTSTRAP',
    actorId: adminUser._id,
    actorEmail: adminUser.email,
    actorName: adminUser.name,
    targetUserId: adminUser._id,
    targetUserEmail: adminUser.email,
    targetUserName: adminUser.name,
    previousRole: null,
    newRole: 'admin',
    previousStatus: null,
    newStatus: 'active',
    reason: 'Initial system bootstrap and regional farm network deployment (12 verified agricultural parcels).',
    ipAddress: '127.0.0.1 (System Provisioning)',
  });

  console.log('[Seed] Database populated successfully:');
  console.log(`  Users:     ${allSeededUsers.length} (1 Admin + 6 Farmers)`);
  console.log(`  Farms:     ${allSeededFarms.length} (12 User Farms + 2 Admin Research Farms)`);
  console.log(`  Fields:    ${allSeededFields.length} (24 User Fields + 4 Admin Research Fields)`);
  console.log(`  Crops:     ${allSeededCycles.length} active cycles`);
  console.log(`  Sensors:   ${allSeededSensors.length} physical sensors`);

  // ==========================================
  // 4. SYNC LOCAL DATA JSON FILES FOR OFFLINE DEVELOPMENT MODE
  // ==========================================
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(allSeededUsers.map(u => u.toJSON ? u.toJSON() : u), null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'farms.json'), JSON.stringify(allSeededFarms.map(f => f.toObject ? f.toObject() : f), null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'fields.json'), JSON.stringify(allSeededFields.map(f => f.toObject ? f.toObject() : f), null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'crop_cycles.json'), JSON.stringify(allSeededCycles.map(c => c.toObject ? c.toObject() : c), null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'tasks.json'), JSON.stringify(allSeededTasks.map(t => t.toObject ? t.toObject() : t), null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'farm_activities.json'), JSON.stringify(allSeededActivities.map(a => a.toObject ? a.toObject() : a), null, 2));
    console.log('[Seed] Synchronized local JSON files in server/data.');
  } catch (syncErr) {
    console.warn('[Seed] Note: Could not sync local JSON files:', syncErr.message);
  }

  await disconnectDB();
  console.log('[Seed] Finished cleanly.');
};

if (process.argv[1] && process.argv[1].endsWith('seedRealData.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
