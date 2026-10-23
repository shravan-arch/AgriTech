import mongoose from 'mongoose';

export const INVENTORY_CATEGORIES = [
  'seeds',
  'fertilizer',
  'chemical',
  'fuel',
  'tools',
  'feed',
  'other',
];

export const INVENTORY_UNITS = ['kg', 'liters', 'bags', 'tonnes', 'packets', 'units'];

const inventoryItemSchema = new mongoose.Schema(
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
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: INVENTORY_CATEGORIES,
        message: 'Invalid inventory category',
      },
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: {
        values: INVENTORY_UNITS,
        message: 'Invalid inventory unit',
      },
      default: 'kg',
    },
    minThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Minimum threshold cannot be negative'],
    },
    costPerUnit: {
      type: Number,
      default: 0,
      min: [0, 'Cost per unit cannot be negative'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ ownerId: 1, farmId: 1, name: 1 });

const InventoryItem =
  mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);

export default InventoryItem;
