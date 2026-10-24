import mongoose from 'mongoose';

const agriculturalResourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: ['seeds', 'fertilizer', 'pesticide', 'machinery', 'equipment', 'irrigation_supplies'],
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: 'kg', // kg, liters, units, bags, packets
    },
    minThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    unitPriceINR: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    supplierContact: {
      type: String,
      trim: true,
      default: '',
    },
    supplierEmail: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock', 'reordered'],
      default: 'in_stock',
      index: true,
    },
    lastRestockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const AgriculturalResource =
  mongoose.models.AgriculturalResource ||
  mongoose.model('AgriculturalResource', agriculturalResourceSchema);

export default AgriculturalResource;
