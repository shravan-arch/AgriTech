import PurchaseRecord from '../models/PurchaseRecord.js';
import { getDBStatus } from '../config/db.js';
import { newLocalId, readLocalCollection, writeLocalCollection } from './localJsonStore.js';
import { invoiceStorage } from './invoiceStorage.js';

const getStorageMode = () => {
  const dbStatus = getDBStatus();
  if (dbStatus.mode === 'mongodb') return 'mongodb';
  if (process.env.NODE_ENV !== 'production' && (process.env.STORAGE_MODE === 'local-json' || process.env.NODE_ENV === 'test')) {
    return 'local-json-development';
  }
  return dbStatus.mode;
};
const unavailableError = () => new Error('Persistent storage is unavailable.');
const toRecord = (document) => JSON.parse(JSON.stringify(document));

const validateLocalDocument = async (Model, record) => {
  const document = new Model(record);
  await document.validate();
  return toRecord(document);
};

export const purchaseStore = {
  /**
   * List purchases for an authenticated owner with optional filtering.
   */
  async listPurchases(ownerId, { status, providerId, limit = 100, skip = 0 } = {}) {
    const mode = getStorageMode();
    const query = { ownerId };
    if (status) query.orderStatus = status;
    if (providerId) query.providerId = providerId;

    if (mode === 'mongodb') {
      return PurchaseRecord.find(query)
        .sort({ purchaseDate: -1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));
    }

    if (mode !== 'local-json-development') throw unavailableError();
    let records = readLocalCollection('purchases').filter(
      (p) => String(p.ownerId) === String(ownerId)
    );
    if (status) {
      records = records.filter((p) => p.orderStatus === status);
    }
    if (providerId) {
      records = records.filter((p) => p.providerId === providerId);
    }
    records.sort((a, b) => new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt));
    return records.slice(Number(skip), Number(skip) + Number(limit));
  },

  /**
   * Find a single purchase by ID, strictly owner-scoped.
   */
  async getPurchaseById(purchaseId, ownerId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return PurchaseRecord.findOne({ _id: purchaseId, ownerId });
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const records = readLocalCollection('purchases');
    const record = records.find(
      (p) =>
        (String(p._id) === String(purchaseId) || String(p.id) === String(purchaseId)) &&
        String(p.ownerId) === String(ownerId)
    );
    return record || null;
  },

  /**
   * Find existing purchase by idempotency key or provider order ID.
   */
  async findExisting({ ownerId, idempotencyKey, externalOrderId, providerId }) {
    const mode = getStorageMode();
    const orConditions = [];
    if (idempotencyKey) orConditions.push({ idempotencyKey });
    if (externalOrderId && providerId) {
      orConditions.push({ externalOrderId, providerId });
    }
    if (orConditions.length === 0) return null;

    if (mode === 'mongodb') {
      return PurchaseRecord.findOne({
        ownerId,
        $or: orConditions,
      });
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const records = readLocalCollection('purchases').filter(
      (p) => String(p.ownerId) === String(ownerId)
    );
    return (
      records.find((p) => {
        if (idempotencyKey && p.idempotencyKey === idempotencyKey) return true;
        if (
          externalOrderId &&
          providerId &&
          p.externalOrderId === externalOrderId &&
          p.providerId === providerId
        ) {
          return true;
        }
        return false;
      }) || null
    );
  },

  /**
   * Create a new purchase record.
   */
  async createPurchase(purchaseData) {
    const mode = getStorageMode();

    // Calculate subtotal and total if not already provided
    const items = (purchaseData.items || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity) || 1,
      unitPriceINR: Number(item.unitPriceINR) || 0,
      subtotalINR:
        item.subtotalINR !== undefined
          ? Number(item.subtotalINR)
          : (Number(item.quantity) || 1) * (Number(item.unitPriceINR) || 0),
    }));
    const calculatedSubtotal = items.reduce(
      (sum, item) => sum + (Number(item.subtotalINR) || 0),
      0
    );
    const subtotalINR = purchaseData.subtotalINR !== undefined ? Number(purchaseData.subtotalINR) : calculatedSubtotal;
    const taxINR = Number(purchaseData.taxINR) || 0;
    const deliveryINR = Number(purchaseData.deliveryINR) || 0;
    const discountINR = Number(purchaseData.discountINR) || 0;
    const totalINR =
      purchaseData.totalINR !== undefined
        ? Number(purchaseData.totalINR)
        : Math.max(0, subtotalINR + taxINR + deliveryINR - discountINR);

    const recordPayload = {
      ...purchaseData,
      items,
      subtotalINR,
      taxINR,
      deliveryINR,
      discountINR,
      totalINR,
      purchaseDate: purchaseData.purchaseDate ? new Date(purchaseData.purchaseDate) : new Date(),
    };

    if (mode === 'mongodb') {
      return PurchaseRecord.create(recordPayload);
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const localRecord = {
      _id: newLocalId(),
      ...recordPayload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const validated = await validateLocalDocument(PurchaseRecord, localRecord);
    const records = readLocalCollection('purchases');
    records.push(validated);
    writeLocalCollection('purchases', records);
    return validated;
  },

  /**
   * Update order and payment status.
   */
  async updateStatus(purchaseId, ownerId, { orderStatus, paymentStatus, externalOrderId, notes, verifiedAt, verifiedBy }) {
    const mode = getStorageMode();
    const updates = {};
    if (orderStatus) updates.orderStatus = orderStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    if (externalOrderId) updates.externalOrderId = externalOrderId;
    if (notes !== undefined) updates.notes = notes;
    if (verifiedAt) updates.verifiedAt = verifiedAt;
    if (verifiedBy) updates.verifiedBy = verifiedBy;
    updates.updatedAt = new Date();

    if (mode === 'mongodb') {
      return PurchaseRecord.findOneAndUpdate(
        { _id: purchaseId, ownerId },
        { $set: updates },
        { new: true, runValidators: true }
      );
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const records = readLocalCollection('purchases');
    const index = records.findIndex(
      (p) =>
        (String(p._id) === String(purchaseId) || String(p.id) === String(purchaseId)) &&
        String(p.ownerId) === String(ownerId)
    );
    if (index === -1) return null;

    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeLocalCollection('purchases', records);
    return records[index];
  },

  /**
   * Attach invoice details to purchase record.
   */
  async attachInvoice(purchaseId, ownerId, invoiceData) {
    const mode = getStorageMode();
    const invoicePayload = {
      invoiceNumber: invoiceData.invoiceNumber || '',
      invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date(),
      supplierTaxId: invoiceData.supplierTaxId || '',
      documentStorageKey: invoiceData.storageKey || '',
      documentStorageProvider: invoiceData.storageProvider || 'local',
      documentMimeType: invoiceData.mimeType || '',
      documentOriginalName: invoiceData.originalName || '',
      documentSize: invoiceData.bytes || 0,
    };

    if (mode === 'mongodb') {
      return PurchaseRecord.findOneAndUpdate(
        { _id: purchaseId, ownerId },
        { $set: { invoice: invoicePayload, updatedAt: new Date() } },
        { new: true }
      );
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const records = readLocalCollection('purchases');
    const index = records.findIndex(
      (p) =>
        (String(p._id) === String(purchaseId) || String(p.id) === String(purchaseId)) &&
        String(p.ownerId) === String(ownerId)
    );
    if (index === -1) return null;

    records[index].invoice = invoicePayload;
    records[index].updatedAt = new Date().toISOString();
    writeLocalCollection('purchases', records);
    return records[index];
  },

  /**
   * Delete purchase record and cleanup invoice file.
   */
  async deletePurchase(purchaseId, ownerId) {
    const mode = getStorageMode();

    if (mode === 'mongodb') {
      const record = await PurchaseRecord.findOne({ _id: purchaseId, ownerId });
      if (!record) return null;

      if (record.invoice?.documentStorageKey) {
        try {
          await invoiceStorage.deleteInvoice({
            storageKey: record.invoice.documentStorageKey,
            storageProvider: record.invoice.documentStorageProvider,
          });
        } catch (err) {
          console.warn('[PurchaseStore] Failed to cleanup invoice file:', err.message);
        }
      }

      await PurchaseRecord.deleteOne({ _id: purchaseId, ownerId });
      return record;
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const records = readLocalCollection('purchases');
    const index = records.findIndex(
      (p) =>
        (String(p._id) === String(purchaseId) || String(p.id) === String(purchaseId)) &&
        String(p.ownerId) === String(ownerId)
    );
    if (index === -1) return null;

    const [deleted] = records.splice(index, 1);
    if (deleted.invoice?.documentStorageKey) {
      try {
        await invoiceStorage.deleteInvoice({
          storageKey: deleted.invoice.documentStorageKey,
          storageProvider: deleted.invoice.documentStorageProvider,
        });
      } catch (err) {
        console.warn('[PurchaseStore] Failed to cleanup invoice file:', err.message);
      }
    }

    writeLocalCollection('purchases', records);
    return deleted;
  },

  /**
   * Compute purchase summaries for dashboard / analytics.
   */
  async getPurchaseStats(ownerId) {
    const purchases = await this.listPurchases(ownerId);
    const totalSpent = purchases
      .filter((p) => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + (p.totalINR || 0), 0);
    const pendingOrders = purchases.filter((p) => !['delivered', 'cancelled'].includes(p.orderStatus)).length;
    const completedOrders = purchases.filter((p) => p.orderStatus === 'delivered').length;

    return {
      totalPurchases: purchases.length,
      totalSpentINR: totalSpent,
      pendingOrders,
      completedOrders,
      supplierCount: new Set(purchases.map((p) => p.supplierName)).size,
    };
  },
};

export default purchaseStore;
