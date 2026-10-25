import mongoose from 'mongoose';

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const fieldPhotoSchema = new mongoose.Schema(
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
    storageProvider: {
      type: String,
      default: 'local',
      trim: true,
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      trim: true,
    },
    storageType: {
      type: String,
      default: 'authenticated',
      trim: true,
    },
    cloudinaryAssetId: {
      type: String,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
    },
    cloudinaryVersion: {
      type: String,
      trim: true,
    },
    cloudinaryFormat: {
      type: String,
      trim: true,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    originalFilename: {
      type: String,
      trim: true,
      maxlength: [255, 'Filename cannot exceed 255 characters'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      enum: {
        values: ALLOWED_PHOTO_MIME_TYPES,
        message: 'Unsupported image MIME type',
      },
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File size must be greater than zero'],
      max: [10 * 1024 * 1024, 'File size cannot exceed 10MB'],
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Observation notes cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

fieldPhotoSchema.index({ ownerId: 1, fieldId: 1, capturedAt: -1 });
fieldPhotoSchema.index({ ownerId: 1, farmId: 1, capturedAt: -1 });

const FieldPhoto =
  mongoose.models.FieldPhoto || mongoose.model('FieldPhoto', fieldPhotoSchema);

export default FieldPhoto;
