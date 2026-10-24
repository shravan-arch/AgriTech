import mongoose from 'mongoose';

const cropContentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: ['crop', 'product', 'service', 'advisory'],
      default: 'crop',
      index: true,
    },
    cropType: {
      type: String,
      trim: true,
      default: '',
    },
    variety: {
      type: String,
      trim: true,
      default: '',
    },
    sowingSeason: {
      type: String,
      trim: true,
      default: '',
    },
    recommendedSoil: {
      type: String,
      trim: true,
      default: '',
    },
    waterRequirement: {
      type: String,
      trim: true,
      default: '',
    },
    pestManagement: {
      type: String,
      trim: true,
      default: '',
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    accuracyVerified: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const CropContent = mongoose.models.CropContent || mongoose.model('CropContent', cropContentSchema);

export default CropContent;
