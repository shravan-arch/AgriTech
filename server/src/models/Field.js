import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Field name is required'],
      trim: true,
      minlength: [1, 'Field name is required'],
      maxlength: [100, 'Field name cannot exceed 100 characters'],
    },
    areaHectares: {
      type: Number,
      required: [true, 'Field area is required'],
      min: [0.01, 'Field area must be greater than zero'],
      max: [1000000, 'Field area is too large'],
    },
    soilType: { type: String, trim: true, maxlength: 100 },
    waterSource: { type: String, trim: true, maxlength: 100 },
    irrigationDetails: { type: String, trim: true, maxlength: 100 },
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },
    calculatedMetrics: {
      approximateAreaSquareMeters: { type: Number },
      approximateAreaHectares: { type: Number },
      approximateAreaAcres: { type: Number },
      approximatePerimeterMeters: { type: Number },
      calculatedAt: { type: Date },
    },
    boundaryMetadata: {
      source: {
        type: String,
        enum: ['user_drawn_approximate', 'official_cadastral', 'gps_walked'],
        default: 'user_drawn_approximate',
      },
      verificationStatus: {
        type: String,
        enum: ['unverified_approximate', 'pending_official_review', 'verified_cadastral'],
        default: 'unverified_approximate',
      },
      legalDisclaimer: {
        type: String,
        default:
          'User-defined approximate boundary for operational farm management only. Not an official cadastral survey, legal title, or property deed verification.',
      },
      lastDrawnAt: { type: Date },
      cadastralReference: {
        surveyNumber: { type: String, trim: true },
        subDivisionNumber: { type: String, trim: true },
        village: { type: String, trim: true },
        tehsil: { type: String, trim: true },
        district: { type: String, trim: true },
        state: { type: String, trim: true },
      },
      satelliteMonitoring: {
        enabled: { type: Boolean, default: false },
        lastPassDate: { type: Date },
        cloudCoverageThreshold: { type: Number, default: 20 },
      },
    },
  },
  { timestamps: true }
);

fieldSchema.index({ ownerId: 1, farmId: 1, createdAt: -1 });
fieldSchema.index({ boundary: '2dsphere' }, { sparse: true });

const Field = mongoose.models.Field || mongoose.model('Field', fieldSchema);

export default Field;
