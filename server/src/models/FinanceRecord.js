import mongoose from 'mongoose';

export const FINANCE_TYPES = ['expense', 'revenue'];

export const FINANCE_CATEGORIES = [
  'seeds',
  'fertilizer',
  'chemical',
  'labor',
  'irrigation',
  'equipment',
  'harvest_sale',
  'maintenance',
  'other',
];

const financeRecordSchema = new mongoose.Schema(
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
    cropCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CropCycle',
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: FINANCE_TYPES,
        message: 'Invalid finance type: must be expense or revenue',
      },
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Finance category is required'],
      enum: {
        values: FINANCE_CATEGORIES,
        message: 'Invalid finance category',
      },
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      maxlength: 10,
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
      default: Date.now,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    receiptNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  { timestamps: true }
);

financeRecordSchema.index({ ownerId: 1, farmId: 1, date: -1 });
financeRecordSchema.index({ ownerId: 1, type: 1, date: -1 });

const FinanceRecord =
  mongoose.models.FinanceRecord || mongoose.model('FinanceRecord', financeRecordSchema);

export default FinanceRecord;
