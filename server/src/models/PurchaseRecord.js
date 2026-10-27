import mongoose from 'mongoose';

export const CHECKOUT_MODES = ['integrated', 'external_redirect', 'manual_import'];
export const PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded'];
export const ORDER_STATUSES = ['initiated', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
export const RECORD_SOURCES = ['provider_api', 'verified_webhook', 'supplier_invoice_import', 'farmer_entered'];
export const PRODUCT_CATEGORIES = ['seeds', 'fertilizer', 'pesticide', 'tools', 'equipment', 'irrigation', 'other'];

const purchaseItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      default: 'other',
    },
    packSize: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    unitPriceINR: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotalINR: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    supplierTaxId: {
      type: String,
      trim: true,
      default: '',
    },
    documentStorageKey: {
      type: String,
      default: '',
    },
    documentStorageProvider: {
      type: String,
      enum: ['local', 'cloudinary'],
      default: 'local',
    },
    documentMimeType: {
      type: String,
      default: '',
    },
    documentOriginalName: {
      type: String,
      default: '',
    },
    documentSize: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const purchaseRecordSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    providerId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    checkoutMode: {
      type: String,
      enum: CHECKOUT_MODES,
      required: true,
      default: 'external_redirect',
    },
    externalOrderId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A purchase record must contain at least one purchased item.',
      },
    },
    subtotalINR: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxINR: {
      type: Number,
      min: 0,
      default: 0,
    },
    deliveryINR: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountINR: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalINR: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'pending',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: 'initiated',
      index: true,
    },
    externalUrl: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: RECORD_SOURCES,
      required: true,
      default: 'farmer_entered',
    },
    invoice: {
      type: purchaseInvoiceSchema,
      default: () => ({}),
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: String,
      default: '',
    },
    isTestRecord: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for owner-scoped queries and ordering
purchaseRecordSchema.index({ ownerId: 1, purchaseDate: -1 });
purchaseRecordSchema.index({ ownerId: 1, providerId: 1 });
purchaseRecordSchema.index({ ownerId: 1, externalOrderId: 1 });

const PurchaseRecord =
  mongoose.models.PurchaseRecord ||
  mongoose.model('PurchaseRecord', purchaseRecordSchema);

export default PurchaseRecord;
