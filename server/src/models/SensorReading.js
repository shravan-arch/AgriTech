import mongoose from 'mongoose';

const sensorReadingSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sensorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sensor',
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
    value: {
      type: Number,
      required: [true, 'Reading value is required'],
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
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

sensorReadingSchema.index({ sensorId: 1, timestamp: -1 });
sensorReadingSchema.index({ fieldId: 1, timestamp: -1 });
sensorReadingSchema.index({ farmId: 1, fieldId: 1, timestamp: -1 });
sensorReadingSchema.index({ ownerId: 1, farmId: 1, timestamp: -1 });

const SensorReading =
  mongoose.models.SensorReading || mongoose.model('SensorReading', sensorReadingSchema);

export default SensorReading;
