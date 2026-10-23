import mongoose from 'mongoose';

export const CROP_STAGES = [
  'sowing',
  'germination',
  'vegetative',
  'flowering',
  'fruiting',
  'ripening',
  'harvested',
  'dormant',
];

export const CROP_STATUSES = ['active', 'completed', 'cancelled'];

const cropCycleSchema = new mongoose.Schema(
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
    fieldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: true,
      index: true,
    },
    cropName: {
      type: String,
      required: [true, 'Crop name is required'],
      trim: true,
      minlength: [1, 'Crop name is required'],
      maxlength: [100, 'Crop name cannot exceed 100 characters'],
    },
    variety: {
      type: String,
      trim: true,
      maxlength: [100, 'Crop variety cannot exceed 100 characters'],
    },
    season: {
      type: String,
      trim: true,
      maxlength: [50, 'Season cannot exceed 50 characters'],
    },
    plantingDate: {
      type: Date,
      required: [true, 'Planting date is required'],
    },
    expectedHarvestDate: {
      type: Date,
    },
    harvestDate: {
      type: Date,
    },
    stage: {
      type: String,
      enum: {
        values: CROP_STAGES,
        message: 'Invalid crop stage',
      },
      default: 'sowing',
    },
    status: {
      type: String,
      enum: {
        values: CROP_STATUSES,
        message: 'Invalid crop status',
      },
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    yieldQuantity: {
      type: Number,
      min: [0, 'Yield quantity cannot be negative'],
    },
    yieldUnit: {
      type: String,
      trim: true,
      maxlength: [20, 'Yield unit cannot exceed 20 characters'],
    },
    stageHistory: [
      {
        stage: { type: String, enum: CROP_STAGES },
        changedAt: { type: Date, default: Date.now },
        notes: { type: String, trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

cropCycleSchema.index({ ownerId: 1, fieldId: 1, status: 1 });
cropCycleSchema.index({ ownerId: 1, farmId: 1, status: 1 });

const CropCycle = mongoose.models.CropCycle || mongoose.model('CropCycle', cropCycleSchema);

export default CropCycle;
