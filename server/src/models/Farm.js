import mongoose from 'mongoose';

export const FARM_TYPES = [
  'Crop Farming',
  'Horticulture',
  'Dairy',
  'Mixed Farming',
  'Organic Farming',
  'Plantation',
  'Other',
];

export const OWNERSHIP_TYPES = [
  'Owned',
  'Leased',
  'Shared',
  'Managed',
  'Other',
];

export const AREA_UNITS = [
  'Acres',
  'Hectares',
  'Bigha',
  'Square Metres',
];

export const SOIL_TYPES = [
  'Alluvial',
  'Black (Regur)',
  'Red & Yellow',
  'Laterite',
  'Clayey',
  'Sandy Loam',
  'Loamy',
  'Saline',
  'Peaty',
  'Other',
];

export const LAND_TERRAINS = [
  'Flat / Plain',
  'Undulating / Rolling',
  'Hilly / Sloped',
  'Terraced',
  'Valley / Lowland',
  'Other',
];

export const WATER_AVAILABILITIES = [
  'Year-round (Perennial)',
  'Seasonal (Monsoon)',
  'Critical / Water Stressed',
  'Groundwater Dependent',
  'Other',
];

export const ELECTRICITY_AVAILABILITIES = [
  '24/7 Grid Power',
  'Intermittent / Dedicated Farm Feeder (6-8 hrs)',
  'Solar Powered',
  'Diesel Generator Backup',
  'No Electricity',
  'Other',
];

export const GREENHOUSE_TYPES = [
  'None',
  'Naturally Ventilated Polyhouse',
  'Hi-Tech Climate Controlled Polyhouse',
  'Shade Net House',
  'Other',
];

export const FARMING_METHODS = [
  'Conventional',
  'Organic Certified',
  'Natural / Zero-Budget (ZBNF)',
  'Hydroponic / Aeroponic',
  'Regenerative',
  'Permaculture',
  'Integrated Pest Management (IPM)',
  'Other',
];

export const SOIL_FERTILITY_LEVELS = [
  'High',
  'Medium',
  'Low',
  'Under Treatment / Restoration',
  'Other',
];

export const ORGANIC_CERT_STATUSES = [
  'Not Certified',
  'In Conversion (Year 1)',
  'In Conversion (Year 2)',
  'In Conversion (Year 3)',
  'Certified Organic (NPOP/NOP)',
  'PGS-India Certified',
  'Participatory Guarantee',
  'Other',
];

export const FARM_STATUSES = [
  'Active',
  'Fallow / Inactive',
  'Under Development',
  'Leased Out',
];

const farmSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Farm name is required'],
      trim: true,
      minlength: [1, 'Farm name is required'],
      maxlength: [100, 'Farm name cannot exceed 100 characters'],
    },
    farmCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    farmType: {
      type: String,
      trim: true,
      enum: FARM_TYPES,
      default: 'Crop Farming',
    },
    ownershipType: {
      type: String,
      trim: true,
      enum: OWNERSHIP_TYPES,
      default: 'Owned',
    },
    establishedYear: {
      type: Number,
      min: [1800, 'Established year must be at or after 1800'],
      max: [2100, 'Established year cannot exceed 2100'],
    },
    coverImage: {
      type: String,
      trim: true,
    },
    location: {
      country: { type: String, trim: true, maxlength: 100, default: 'India' },
      region: { type: String, trim: true, maxlength: 100 },
      state: { type: String, trim: true, maxlength: 100 },
      district: { type: String, trim: true, maxlength: 100 },
      city: { type: String, trim: true, maxlength: 100 },
      tehsil: { type: String, trim: true, maxlength: 100 },
      village: { type: String, trim: true, maxlength: 100 },
      address: { type: String, trim: true, maxlength: 500 },
      postalCode: { type: String, trim: true, maxlength: 20 },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    landDetails: {
      totalArea: { type: Number, min: 0 },
      areaUnit: {
        type: String,
        trim: true,
        enum: AREA_UNITS,
        default: 'Acres',
      },
      cultivableArea: { type: Number, min: 0 },
      irrigatedArea: { type: Number, min: 0 },
      nonCultivableArea: { type: Number, min: 0 },
      soilType: {
        type: String,
        trim: true,
        enum: SOIL_TYPES,
        default: 'Alluvial',
      },
      landTerrain: {
        type: String,
        trim: true,
        enum: LAND_TERRAINS,
        default: 'Flat / Plain',
      },
    },
    infrastructure: {
      irrigationSources: [{ type: String, trim: true }],
      irrigationMethods: [{ type: String, trim: true }],
      waterAvailability: {
        type: String,
        trim: true,
        enum: WATER_AVAILABILITIES,
        default: 'Year-round (Perennial)',
      },
      electricityAvailability: {
        type: String,
        trim: true,
        enum: ELECTRICITY_AVAILABILITIES,
        default: '24/7 Grid Power',
      },
      storageFacilities: [{ type: String, trim: true }],
      greenhousePolyhouse: {
        type: String,
        trim: true,
        enum: GREENHOUSE_TYPES,
        default: 'None',
      },
      farmEquipment: [{ type: String, trim: true }],
    },
    agriculturalDetails: {
      primaryCrops: [{ type: String, trim: true }],
      farmingMethod: {
        type: String,
        trim: true,
        enum: FARMING_METHODS,
        default: 'Conventional',
      },
      farmingSeasons: [{ type: String, trim: true }],
      soilFertility: {
        type: String,
        trim: true,
        enum: SOIL_FERTILITY_LEVELS,
        default: 'Medium',
      },
      annualRainfallMm: { type: Number, min: 0 },
      organicCertStatus: {
        type: String,
        trim: true,
        enum: ORGANIC_CERT_STATUSES,
        default: 'Not Certified',
      },
      agriculturalNotes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Agricultural notes cannot exceed 2000 characters'],
      },
    },
    management: {
      managerName: { type: String, trim: true, maxlength: 100 },
      contactPerson: { type: String, trim: true, maxlength: 100 },
      contactPhone: { type: String, trim: true, maxlength: 30 },
      contactEmail: { type: String, trim: true, lowercase: true, maxlength: 120 },
      farmStatus: {
        type: String,
        trim: true,
        enum: FARM_STATUSES,
        default: 'Active',
      },
      internalNotes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Internal notes cannot exceed 2000 characters'],
      },
    },
  },
  { timestamps: true }
);

farmSchema.pre('validate', function (next) {
  if (!this.farmCode) {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.farmCode = `FRM-${randomSuffix}`;
  }
  // Ensure location region and state stay synchronized for legacy compatibility
  if (this.location) {
    if (this.location.state && !this.location.region) {
      this.location.region = this.location.state;
    } else if (this.location.region && !this.location.state) {
      this.location.state = this.location.region;
    }
  }
  next();
});

farmSchema.index({ ownerId: 1, createdAt: -1 });

const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema);

export default Farm;
