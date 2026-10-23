import mongoose from 'mongoose';

export const MOVEMENT_TYPES = ['in', 'out'];
export const MOVEMENT_REASONS = [
  'purchase',
  'application',
  'sale',
  'spoilage',
  'adjustment',
  'transfer',
];

const inventoryMovementSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
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
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: MOVEMENT_TYPES,
        message: 'Movement type must be in or out',
      },
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Movement quantity is required'],
      min: [0.001, 'Quantity must be greater than zero'],
    },
    reason: {
      type: String,
      required: true,
      enum: {
        values: MOVEMENT_REASONS,
        message: 'Invalid movement reason',
      },
      default: 'application',
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

inventoryMovementSchema.index({ ownerId: 1, itemId: 1, date: -1 });

const InventoryMovement =
  mongoose.models.InventoryMovement ||
  mongoose.model('InventoryMovement', inventoryMovementSchema);

export default InventoryMovement;
