import mongoose from 'mongoose';

const weatherSnapshotSchema = new mongoose.Schema(
  {
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    temperature: {
      type: Number,
      required: true,
    },
    apparentTemperature: {
      type: Number,
    },
    humidity: {
      type: Number,
      min: 0,
      max: 100,
    },
    precipitation: {
      type: Number,
      default: 0,
    },
    rain: {
      type: Number,
      default: 0,
    },
    windSpeed: {
      type: Number,
    },
    windDirection: {
      type: Number,
    },
    weatherCode: {
      type: Number,
    },
    condition: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      default: 'Open-Meteo Meteorological Model',
      trim: true,
    },
    isSimulated: {
      type: Boolean,
      default: false,
      index: true,
    },
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      elevation: { type: Number },
    },
  },
  { timestamps: true }
);

weatherSnapshotSchema.index({ farmId: 1, timestamp: -1 });
weatherSnapshotSchema.index({ ownerId: 1, farmId: 1, timestamp: -1 });

const WeatherSnapshot =
  mongoose.models.WeatherSnapshot || mongoose.model('WeatherSnapshot', weatherSnapshotSchema);

export default WeatherSnapshot;
