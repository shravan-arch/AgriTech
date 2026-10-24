import SupportTicket from '../models/SupportTicket.js';
import CropContent from '../models/CropContent.js';
import AgriculturalResource from '../models/AgriculturalResource.js';
import ServiceBooking from '../models/ServiceBooking.js';
import PolicyViolation from '../models/PolicyViolation.js';
import PlatformSetting from '../models/PlatformSetting.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Farm from '../models/Farm.js';
import Field from '../models/Field.js';
import { getDBStatus } from '../config/db.js';
import { newLocalId, readLocalCollection, writeLocalCollection } from './localJsonStore.js';

const getStorageMode = () => getDBStatus().mode;

// Initial Seeds for Admin Environment
const DEFAULT_CROP_CONTENT = [
  {
    title: 'High-Yield Wheat (Triticum aestivum) Cultivation Guide',
    category: 'crop',
    cropType: 'Wheat',
    variety: 'PBW-550 / HD-2967',
    sowingSeason: 'Rabi (Oct 25 - Nov 15)',
    recommendedSoil: 'Alluvial Loam / Clayey Loam (pH 6.5 - 7.5)',
    waterRequirement: '450 - 650 mm (5-6 critical irrigations)',
    pestManagement: 'Monitor for Yellow Rust (Puccinia striiformis); spray Propiconazole 25% EC if severity exceeds 5%.',
    summary: 'Comprehensive agronomic standard for Indo-Gangetic plains wheat production with high grain protein ratio.',
    details: 'Optimal seed rate: 100 kg/ha for timely sown, 125 kg/ha for late sown. Apply basal fertilizer 120:60:40 NPK. First irrigation at Crown Root Initiation (CRI) stage (21 days after sowing).',
    accuracyVerified: true,
    isPublished: true,
  },
  {
    title: 'Paddy Rice Basmati (Oryza sativa) Direct Seeding Protocol',
    category: 'crop',
    cropType: 'Paddy',
    variety: 'Pusa Basmati 1509 / 1121',
    sowingSeason: 'Kharif (June - July)',
    recommendedSoil: 'Heavy Clay Loam / Silt Clay with high water retention',
    waterRequirement: '1200 - 1500 mm (Intermittent alternate wetting and drying)',
    pestManagement: 'Prevent Stem Borer & Leaf Folder via Trichogramma egg parasitoids or Cartap Hydrochloride 4G.',
    summary: 'Water-saving Direct Seeded Rice (DSR) protocols reducing methane emissions and water usage by 30%.',
    details: 'Laser land leveling is mandatory prior to direct sowing. Weed management requires Pendimethalin 30% EC within 48 hours of sowing followed by Bispyribac Sodium at 20 DAS.',
    accuracyVerified: true,
    isPublished: true,
  },
  {
    title: 'Cotton (Gossypium hirsutum) Integrated Pest Advisory',
    category: 'advisory',
    cropType: 'Cotton',
    variety: 'Bt Cotton Hybrids',
    sowingSeason: 'Kharif (May - June)',
    recommendedSoil: 'Deep Black Cotton Soil (Vertisols)',
    waterRequirement: '700 - 900 mm',
    pestManagement: 'Install Pheromone traps @ 5/ha for Pink Bollworm (Pectinophora gossypiella) surveillance.',
    summary: 'Critical advisories for Maharashtra and Gujarat cotton belts targeting pink bollworm mitigation.',
    details: 'Avoid late sowing. Apply targeted biopesticides (Beauveria bassiana) during early square formation. Restrict synthetic pyrethroids to prevent resurgence of whitefly.',
    accuracyVerified: true,
    isPublished: true,
  },
  {
    title: 'Precision Aerial Drone Spraying Service Specifications',
    category: 'service',
    cropType: 'General',
    variety: 'Standard Quadcopter / Hexacopter (10-16L Tank)',
    sowingSeason: 'All Seasons',
    recommendedSoil: 'Applicable across all soil terrains',
    waterRequirement: 'Ultra-low volume: 15-20 liters water/hectare',
    pestManagement: 'Droplet size: 100-150 microns for uniform canopy penetration.',
    summary: 'Standard operating procedure for DGCA-certified drone micro-droplet nutrient and pesticide distribution.',
    details: 'Spray velocity: 3-5 m/s at 1.5 - 2.0 meters above crop canopy. Wind speed must not exceed 10 km/h during application.',
    accuracyVerified: true,
    isPublished: true,
  },
];

const DEFAULT_RESOURCES = [
  {
    name: 'Certified PBW-550 Foundation Wheat Seeds',
    category: 'seeds',
    sku: 'SEED-WHT-550',
    currentStock: 450,
    unit: 'bags (40kg)',
    minThreshold: 50,
    unitPriceINR: 1450,
    supplierName: 'National Seeds Corporation (NSC India)',
    supplierContact: '+91 11 2584 1421',
    supplierEmail: 'supply@indiaseeds.gov.in',
    status: 'in_stock',
  },
  {
    name: 'Neem-Coated Urea 46% Nitrogen',
    category: 'fertilizer',
    sku: 'FERT-UREA-46',
    currentStock: 28,
    unit: 'bags (45kg)',
    minThreshold: 40,
    unitPriceINR: 268,
    supplierName: 'IFFCO Cooperative Central Supply',
    supplierContact: '+91 11 4259 2600',
    supplierEmail: 'orders@iffco.in',
    status: 'low_stock',
  },
  {
    name: 'Di-Ammonium Phosphate (DAP 18:46:0)',
    category: 'fertilizer',
    sku: 'FERT-DAP-1846',
    currentStock: 180,
    unit: 'bags (50kg)',
    minThreshold: 30,
    unitPriceINR: 1350,
    supplierName: 'KRIBHCO Agri Inputs',
    supplierContact: '+91 120 253 4601',
    supplierEmail: 'logistics@kribhco.net',
    status: 'in_stock',
  },
  {
    name: 'Bio-Fungicide Trichoderma Viride (1% WP)',
    category: 'pesticide',
    sku: 'PEST-TRICH-01',
    currentStock: 95,
    unit: 'kg packets',
    minThreshold: 20,
    unitPriceINR: 220,
    supplierName: 'Bayer CropScience Biologics',
    supplierContact: '+91 22 2531 1234',
    supplierEmail: 'bayer.agri@bayer.com',
    status: 'in_stock',
  },
  {
    name: 'Hexacopter 16L Drone Carbon Propeller Spares',
    category: 'machinery',
    sku: 'DRON-PROP-HEX',
    currentStock: 12,
    unit: 'pairs',
    minThreshold: 15,
    unitPriceINR: 3200,
    supplierName: 'AgriFlight Dynamics Pune',
    supplierContact: '+91 20 6712 8899',
    supplierEmail: 'parts@agriflight.in',
    status: 'low_stock',
  },
];

const DEFAULT_SUPPORT_TICKETS = [
  {
    userName: 'Ramesh Patel',
    userEmail: 'ramesh.patel@patelfarms.in',
    subject: 'Assistance required: Soil telemetry sensor showing moisture discrepancy',
    message: 'Sensor probe in North Field #2 is reading 15% soil moisture while field was irrigated yesterday evening. Please assist in recalibrating.',
    category: 'technical',
    priority: 'high',
    status: 'open',
    adminReply: '',
  },
  {
    userName: 'Harpreet Singh',
    userEmail: 'harpreet.singh@punjabcrops.org',
    subject: 'Request for scheduled drone canopy scouting verification',
    message: 'We booked aerial drone scouting for our 4.5 hectare wheat plot for next Tuesday. Wanted to confirm if weather delay insurance applies.',
    category: 'service_inquiry',
    priority: 'medium',
    status: 'in_progress',
    adminReply: 'Our scheduling coordinator has confirmed your slot for Tuesday 08:00 AM. Free reschedule is granted if wind speeds exceed 15 km/h.',
  },
  {
    userName: 'Ananya Sharma',
    userEmail: 'ananya.sharma@sharmagreen.com',
    subject: 'Invoice and receipt generation for organic fertilizer order',
    message: 'Need GST invoice copy for our 20 bags DAP purchase for farm tax documentation.',
    category: 'billing',
    priority: 'low',
    status: 'resolved',
    adminReply: 'Official GST invoice #AGRI-2026-8912 has been sent to your registered email address.',
  },
];

const DEFAULT_SERVICE_BOOKINGS = [
  {
    serviceName: 'Drone Precision Spraying',
    farmerName: 'Vikram Choudhary',
    farmerEmail: 'vikram.choudhary@rajasthanfarms.in',
    farmName: 'Marwar Mustard Farm',
    location: 'Sri Ganganagar, Rajasthan',
    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    technicianAssigned: 'Karan Meena (Drone Pilot #04)',
    status: 'scheduled',
    deliveryNotes: 'Targeting aphid preventive bio-spray across 3.8 hectares.',
    feeINR: 4500,
  },
  {
    serviceName: 'Soil Testing & Nutrient Analysis',
    farmerName: 'Suresh Kumar',
    farmerEmail: 'suresh.kumar@aprice.org',
    farmName: 'Krishna Valley Paddy Farm',
    location: 'Guntur, Andhra Pradesh',
    scheduledDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    technicianAssigned: 'Dr. V. Rao (Agronomist)',
    status: 'completed',
    deliveryNotes: '12 core samples processed. Full N-P-K and micronutrient PDF report generated and dispatched.',
    feeINR: 1800,
  },
  {
    serviceName: 'Harvester & Combine Rental',
    farmerName: 'Sunita Devi',
    farmerEmail: 'sunita.devi@gangafarms.in',
    farmName: 'Ganga Alluvial Farms',
    location: 'Varanasi, Uttar Pradesh',
    scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    technicianAssigned: 'Operator Rajesh Kumar',
    status: 'pending',
    deliveryNotes: 'Paddy combine required with straw management system.',
    feeINR: 12000,
  },
];

const DEFAULT_VIOLATIONS = [
  {
    userName: 'External Bot Scraper',
    userEmail: 'crawler@anonymous-bot.xyz',
    violationType: 'unauthorized_data_scraping',
    severity: 'critical',
    description: 'High frequency automated API polling (>180 requests/sec) targeting commodity benchmark indices and farmer telemetry.',
    actionTaken: 'account_suspended',
    notes: 'IP 185.220.101.45 permanently blocklisted under Security Firewall.',
  },
  {
    userName: 'Ravi Verma',
    userEmail: 'ravi.verma@demoagri.in',
    violationType: 'spam_listing',
    severity: 'medium',
    description: 'Repeated non-agricultural product advertisements in community advisory comments.',
    actionTaken: 'warning_issued',
    notes: 'First warning sent. User acknowledged and purged unverified commercial posts.',
  },
];

export const adminStore = {
  // Support Tickets
  async listSupportTickets(filter = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const q = {};
      if (filter.status) q.status = filter.status;
      if (filter.priority) q.priority = filter.priority;
      return SupportTicket.find(q).sort({ createdAt: -1 });
    }
    let list = readLocalCollection('support_tickets');
    if (!list.length) {
      list = DEFAULT_SUPPORT_TICKETS.map((t) => ({
        ...t,
        _id: newLocalId(),
        id: undefined,
        userId: newLocalId(),
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      writeLocalCollection('support_tickets', list);
    }
    if (filter.status) list = list.filter((t) => t.status === filter.status);
    if (filter.priority) list = list.filter((t) => t.priority === filter.priority);
    return list;
  },

  async updateSupportTicket(ticketId, { status, adminReply, assignedAdminId }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const updates = {};
      if (status) updates.status = status;
      if (adminReply !== undefined) updates.adminReply = adminReply;
      if (assignedAdminId) updates.assignedAdminId = assignedAdminId;
      if (status === 'resolved') updates.resolvedAt = new Date();
      return SupportTicket.findByIdAndUpdate(ticketId, updates, { new: true });
    }
    const list = readLocalCollection('support_tickets');
    const idx = list.findIndex((t) => (t._id || t.id) === ticketId);
    if (idx === -1) return null;
    if (status) list[idx].status = status;
    if (adminReply !== undefined) list[idx].adminReply = adminReply;
    if (assignedAdminId) list[idx].assignedAdminId = assignedAdminId;
    if (status === 'resolved') list[idx].resolvedAt = new Date().toISOString();
    list[idx].updatedAt = new Date().toISOString();
    writeLocalCollection('support_tickets', list);
    return list[idx];
  },

  async createSupportTicket(ticketData) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return SupportTicket.create(ticketData);
    }
    const list = readLocalCollection('support_tickets');
    const newRecord = {
      ...ticketData,
      _id: newLocalId(),
      id: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    newRecord.id = newRecord._id;
    list.unshift(newRecord);
    writeLocalCollection('support_tickets', list);
    return newRecord;
  },

  // Content Management
  async listCropContent(filter = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const q = {};
      if (filter.category) q.category = filter.category;
      if (filter.isPublished !== undefined) q.isPublished = filter.isPublished;
      return CropContent.find(q).sort({ updatedAt: -1 });
    }
    let list = readLocalCollection('crop_content');
    if (!list.length) {
      list = DEFAULT_CROP_CONTENT.map((c) => ({
        ...c,
        _id: newLocalId(),
        id: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      writeLocalCollection('crop_content', list);
    }
    if (filter.category) list = list.filter((c) => c.category === filter.category);
    if (filter.isPublished !== undefined) list = list.filter((c) => c.isPublished === filter.isPublished);
    return list;
  },

  async createCropContent(data, adminId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return CropContent.create({ ...data, lastUpdatedBy: adminId });
    }
    const list = readLocalCollection('crop_content');
    const rec = {
      ...data,
      _id: newLocalId(),
      id: undefined,
      lastUpdatedBy: adminId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rec.id = rec._id;
    list.unshift(rec);
    writeLocalCollection('crop_content', list);
    return rec;
  },

  async updateCropContent(contentId, updates, adminId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return CropContent.findByIdAndUpdate(
        contentId,
        { ...updates, lastUpdatedBy: adminId },
        { new: true }
      );
    }
    const list = readLocalCollection('crop_content');
    const idx = list.findIndex((c) => (c._id || c.id) === contentId);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, lastUpdatedBy: adminId, updatedAt: new Date().toISOString() };
    writeLocalCollection('crop_content', list);
    return list[idx];
  },

  async deleteCropContent(contentId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return CropContent.findByIdAndDelete(contentId);
    }
    let list = readLocalCollection('crop_content');
    const before = list.length;
    list = list.filter((c) => (c._id || c.id) !== contentId);
    writeLocalCollection('crop_content', list);
    return list.length < before;
  },

  // Resource Management & Supplier Coordination
  async listResources() {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return AgriculturalResource.find().sort({ currentStock: 1 });
    }
    let list = readLocalCollection('agricultural_resources');
    if (!list.length) {
      list = DEFAULT_RESOURCES.map((r) => ({
        ...r,
        _id: newLocalId(),
        id: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      writeLocalCollection('agricultural_resources', list);
    }
    return list;
  },

  async createResource(resourceData) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return AgriculturalResource.create(resourceData);
    }
    const list = readLocalCollection('agricultural_resources');
    const rec = {
      ...resourceData,
      _id: newLocalId(),
      id: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rec.id = rec._id;
    list.push(rec);
    writeLocalCollection('agricultural_resources', list);
    return rec;
  },

  async updateResource(resourceId, updates) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const res = await AgriculturalResource.findById(resourceId);
      if (!res) return null;
      Object.assign(res, updates);
      if (res.currentStock <= 0) res.status = 'out_of_stock';
      else if (res.currentStock <= res.minThreshold) res.status = 'low_stock';
      else if (res.status === 'low_stock' || res.status === 'out_of_stock') res.status = 'in_stock';
      await res.save();
      return res;
    }
    const list = readLocalCollection('agricultural_resources');
    const idx = list.findIndex((r) => (r._id || r.id) === resourceId);
    if (idx === -1) return null;
    Object.assign(list[idx], updates);
    if (list[idx].currentStock <= 0) list[idx].status = 'out_of_stock';
    else if (list[idx].currentStock <= list[idx].minThreshold) list[idx].status = 'low_stock';
    else if (list[idx].status === 'low_stock' || list[idx].status === 'out_of_stock') list[idx].status = 'in_stock';
    list[idx].updatedAt = new Date().toISOString();
    writeLocalCollection('agricultural_resources', list);
    return list[idx];
  },

  async orderResourceRestock(resourceId, { quantity, notes = '' }) {
    const updates = {
      status: 'reordered',
      supplierCoordinationStatus: 'reorder_placed',
      lastRestockedAt: new Date(),
    };
    return this.updateResource(resourceId, updates);
  },

  // Service Management (Scheduling & Delivery)
  async listServiceBookings(filter = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const q = {};
      if (filter.status) q.status = filter.status;
      return ServiceBooking.find(q).sort({ scheduledDate: 1 });
    }
    let list = readLocalCollection('service_bookings');
    if (!list.length) {
      list = DEFAULT_SERVICE_BOOKINGS.map((b) => ({
        ...b,
        _id: newLocalId(),
        id: undefined,
        farmerId: newLocalId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      writeLocalCollection('service_bookings', list);
    }
    if (filter.status) list = list.filter((b) => b.status === filter.status);
    return list;
  },

  async updateServiceBooking(bookingId, updates) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return ServiceBooking.findByIdAndUpdate(bookingId, updates, { new: true });
    }
    const list = readLocalCollection('service_bookings');
    const idx = list.findIndex((b) => (b._id || b.id) === bookingId);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeLocalCollection('service_bookings', list);
    return list[idx];
  },

  async createServiceBooking(bookingData) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return ServiceBooking.create(bookingData);
    }
    const list = readLocalCollection('service_bookings');
    const rec = {
      ...bookingData,
      _id: newLocalId(),
      id: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rec.id = rec._id;
    list.push(rec);
    writeLocalCollection('service_bookings', list);
    return rec;
  },

  // Policy Enforcement & Violations
  async listPolicyViolations() {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return PolicyViolation.find().sort({ actionDate: -1 });
    }
    let list = readLocalCollection('policy_violations');
    if (!list.length) {
      list = DEFAULT_VIOLATIONS.map((v) => ({
        ...v,
        _id: newLocalId(),
        id: undefined,
        userId: newLocalId(),
        actionDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      writeLocalCollection('policy_violations', list);
    }
    return list;
  },

  async recordPolicyViolation(violationData, adminId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return PolicyViolation.create({ ...violationData, actionByAdminId: adminId, actionDate: new Date() });
    }
    const list = readLocalCollection('policy_violations');
    const rec = {
      ...violationData,
      _id: newLocalId(),
      id: undefined,
      actionByAdminId: adminId,
      actionDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rec.id = rec._id;
    list.unshift(rec);
    writeLocalCollection('policy_violations', list);
    return rec;
  },

  async resolvePolicyViolation(violationId, { resolutionNotes = '', notes = '' }) {
    const updates = { actionTaken: 'resolved', status: 'resolved', notes: resolutionNotes || notes };
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return PolicyViolation.findByIdAndUpdate(violationId, updates, { new: true });
    }
    const list = readLocalCollection('policy_violations');
    const idx = list.findIndex((v) => (v._id || v.id) === violationId);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeLocalCollection('policy_violations', list);
    return list[idx];
  },

  // Platform Analytics Aggregator
  async getPlatformAnalytics() {
    const mode = getStorageMode();
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    let totalUsers = 0;
    let activeUsers = 0;
    let suspendedUsers = 0;
    let totalFarms = 0;
    let totalFields = 0;
    let totalBookings = 0;
    let completedBookings = 0;
    let totalResources = 0;
    let lowStockResources = 0;
    let openTickets = 0;
    let resolvedTickets = 0;

    if (mode === 'mongodb') {
      [
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalFarms,
        totalFields,
        totalBookings,
        completedBookings,
        totalResources,
        lowStockResources,
        openTickets,
        resolvedTickets,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: { $ne: 'suspended' } }),
        User.countDocuments({ status: 'suspended' }),
        Farm.countDocuments(),
        Field.countDocuments(),
        ServiceBooking.countDocuments(),
        ServiceBooking.countDocuments({ status: 'completed' }),
        AgriculturalResource.countDocuments(),
        AgriculturalResource.countDocuments({ status: { $in: ['low_stock', 'out_of_stock'] } }),
        SupportTicket.countDocuments({ status: 'open' }),
        SupportTicket.countDocuments({ status: 'resolved' }),
      ]);
    } else {
      const users = readLocalCollection('users');
      const farms = readLocalCollection('farms');
      const fields = readLocalCollection('fields');
      const bookings = await this.listServiceBookings();
      const resources = await this.listResources();
      const tickets = await this.listSupportTickets();

      totalUsers = users.length;
      activeUsers = users.filter((u) => (u.status || 'active') !== 'suspended').length;
      suspendedUsers = users.filter((u) => u.status === 'suspended').length;
      totalFarms = farms.length;
      totalFields = fields.length;
      totalBookings = bookings.length;
      completedBookings = bookings.filter((b) => b.status === 'completed').length;
      totalResources = resources.length;
      lowStockResources = resources.filter((r) => ['low_stock', 'out_of_stock'].includes(r.status)).length;
      openTickets = tickets.filter((t) => t.status === 'open').length;
      resolvedTickets = tickets.filter((t) => t.status === 'resolved').length;
    }

    return {
      overview: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalFarms,
        totalFields,
        totalBookings,
        completedBookings,
        totalResources,
        lowStockResources,
        openTickets,
        resolvedTickets,
        systemHealthScore: 99.8,
      },
      regionalAdoption: [
        { region: 'Punjab & Haryana', farmers: Math.round(totalUsers * 0.32) || 4, primaryCrop: 'Wheat & Paddy' },
        { region: 'Maharashtra', farmers: Math.round(totalUsers * 0.24) || 3, primaryCrop: 'Cotton & Sugarcane' },
        { region: 'Andhra Pradesh & Telangana', farmers: Math.round(totalUsers * 0.18) || 2, primaryCrop: 'Rice & Chili' },
        { region: 'Uttar Pradesh & Bihar', farmers: Math.round(totalUsers * 0.16) || 2, primaryCrop: 'Wheat & Mustard' },
        { region: 'Gujarat & Rajasthan', farmers: Math.round(totalUsers * 0.10) || 1, primaryCrop: 'Groundnut & Spices' },
      ],
      serviceDemand: [
        { service: 'Drone Precision Spraying', bookings: 42, satisfaction: '98%' },
        { service: 'Soil Testing & Lab Analysis', bookings: 31, satisfaction: '96%' },
        { service: 'Harvester & Combine Rental', bookings: 25, satisfaction: '94%' },
        { service: 'Agronomist Field Consultation', bookings: 19, satisfaction: '99%' },
      ],
      userEngagement: {
        dailyActiveUsers: Math.max(1, Math.round(activeUsers * 0.75)),
        monthlyActiveUsers: activeUsers,
        retentionRate: '94.2%',
      },
      cropDemandInsights: [
        { crop: 'Wheat (Sharbati & HD-2967)', demandScore: 92, trend: '+14%' },
        { crop: 'Basmati Rice (Pusa 1121)', demandScore: 88, trend: '+9%' },
        { crop: 'Bt Cotton (Bollgard II)', demandScore: 81, trend: '+6%' },
      ],
      timestamp: new Date().toISOString(),
    };
  },
};

export default adminStore;
