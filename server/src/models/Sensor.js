import mongoose from 'mongoose';

export const SENSOR_TYPES = [
  'soil_moisture',
  'soil_temperature',
  'air_temperature',
  'humidity',
  'rainfall',
];

export const SENSOR_STATUSES = ['active', 'offline', 'maintenance'];

const sensorSchema = new mongoose.Schema(
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
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Sensor name is required'],
      trim: true,
      maxlength: [100, 'Sensor name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Sensor type is required'],
      enum: {
        values: SENSOR_TYPES,
        message: 'Invalid sensor type',
      },
      index: true,
    },
    deviceUid: {
      type: String,
      required: [true, 'Device UID is required'],
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: SENSOR_STATUSES,
      default: 'active',
      index: true,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    lastReadingAt: {
      type: Date,
    },
    thresholds: {
      min: { type: Number },
      max: { type: Number },
      unit: { type: String, default: '%' },
    },
    isSimulated: {
      type: Boolean,
      default: false,
      index: true,
    },
    source: {
      type: String,
      enum: ['physical', 'simulated'],
      default: 'physical',
      index: true,
    },
  },
  { timestamps: true }
);

sensorSchema.index({ ownerId: 1, farmId: 1, fieldId: 1 });
sensorSchema.index({ ownerId: 1, deviceUid: 1 }, { unique: true });

const Sensor = mongoose.models.Sensor || mongoose.model('Sensor', sensorSchema);

export default Sensor;
