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
  },
  { timestamps: true }
);

fieldSchema.index({ ownerId: 1, farmId: 1, createdAt: -1 });

const Field = mongoose.models.Field || mongoose.model('Field', fieldSchema);

export default Field;
