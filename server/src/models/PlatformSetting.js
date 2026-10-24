import mongoose from 'mongoose';

const platformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    supportedLanguages: {
      type: [String],
      default: ['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'],
    },
    allowPublicRegistration: {
      type: Boolean,
      default: true,
    },
    requireEmailVerification: {
      type: Boolean,
      default: false,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    systemNotice: {
      type: String,
      trim: true,
      maxlength: [500, 'System notice cannot exceed 500 characters'],
      default: '',
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 1440,
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
      min: 3,
      max: 20,
    },
    requireTwoFactor: {
      type: Boolean,
      default: false,
    },
    blockedIPs: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const PlatformSetting =
  mongoose.models.PlatformSetting ||
  mongoose.model('PlatformSetting', platformSettingSchema);

export default PlatformSetting;
