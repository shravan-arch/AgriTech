import mongoose from 'mongoose';

export const ACTIVITY_TYPES = [
  'planting',
  'irrigation',
  'fertilizer',
  'pest_observation',
  'treatment',
  'inspection',
  'labor',
  'harvesting',
];

const inputItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    quantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false }
);

const farmActivitySchema = new mongoose.Schema(
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
    cropCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CropCycle',
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Activity type is required'],
      enum: {
        values: ACTIVITY_TYPES,
        message: 'Invalid activity type',
      },
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Activity date is required'],
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    inputs: [inputItemSchema],
    cost: {
      type: Number,
      min: [0, 'Cost must be non-negative'],
    },
    performedBy: {
      type: String,
      trim: true,
      maxlength: [100, 'Performed by cannot exceed 100 characters'],
    },
  },
  { timestamps: true }
);

farmActivitySchema.index({ ownerId: 1, fieldId: 1, date: -1 });
farmActivitySchema.index({ ownerId: 1, farmId: 1, date: -1 });

const FarmActivity =
  mongoose.models.FarmActivity || mongoose.model('FarmActivity', farmActivitySchema);

export default FarmActivity;
