import { farmStore as defaultFarmStore } from '../storage/farmStore.js';

export const createInventoryController = (farmStore = defaultFarmStore) => ({
  async listItems(req, res, next) {
    try {
      const items = await farmStore.listInventoryItems(req.user._id, req.query);
      const enhanced = items.map((item) => {
        const doc = item.toObject ? item.toObject() : { ...item };
        doc.isLowStock = Number(doc.quantity) <= Number(doc.minThreshold || 0);
        return doc;
      });
      return res.status(200).json({
        success: true,
        count: enhanced.length,
        data: enhanced,
      });
    } catch (err) {
      return next(err);
    }
  },

  async getItem(req, res, next) {
    try {
      const item = await farmStore.findInventoryItem(req.user._id, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Not Found', message: 'Inventory item not found.' });
      }
      const doc = item.toObject ? item.toObject() : { ...item };
      doc.isLowStock = Number(doc.quantity) <= Number(doc.minThreshold || 0);
      return res.status(200).json({
        success: true,
        data: doc,
      });
    } catch (err) {
      return next(err);
    }
  },

  async createItem(req, res, next) {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    try {
      const { farmId, name, category, unit } = req.body;
      if (!farmId) {
        return res.status(400).json({ error: 'Validation Error', message: 'Farm ID is required.' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Item name is required.' });
      }
      if (!category) {
        return res.status(400).json({ error: 'Validation Error', message: 'Category is required.' });
      }
      if (!unit) {
        return res.status(400).json({ error: 'Validation Error', message: 'Unit of measure is required.' });
      }

      const result = await farmStore.createInventoryItem(req.user._id, req.body);
      if (result.notFound) {
        return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      }

      return res.status(201).json({
        success: true,
        data: result.item,
      });
    } catch (err) {
      return next(err);
    }
  },

  async updateItem(req, res, next) {
    try {
      const existing = await farmStore.findInventoryItem(req.user._id, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Not Found', message: 'Inventory item not found.' });
      }
      if (req.user.role === 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot modify their own inventory directly.',
        });
      }

      const updated = await farmStore.updateInventoryItem(req.user._id, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  },

  async deleteItem(req, res, next) {
    try {
      const existing = await farmStore.findInventoryItem(req.user._id, req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Not Found', message: 'Inventory item not found.' });
      }
      if (req.user.role === 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot delete their own inventory directly.',
        });
      }

      const deleted = await farmStore.deleteInventoryItem(req.user._id, req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Inventory item deleted.',
        data: deleted,
      });
    } catch (err) {
      return next(err);
    }
  },

  async logMovement(req, res, next) {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    try {
      const { itemId, type, quantity, reason } = req.body;
      if (!itemId) {
        return res.status(400).json({ error: 'Validation Error', message: 'Item ID is required.' });
      }
      if (!type || !['in', 'out'].includes(type)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Movement type must be "in" or "out".' });
      }
      if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Quantity must be a positive number.' });
      }

      const result = await farmStore.logInventoryMovement(req.user._id, {
        itemId,
        type,
        quantity: Number(quantity),
        reason: reason || (type === 'in' ? 'purchase' : 'application'),
        date: req.body.date,
        notes: req.body.notes,
        fieldId: req.body.fieldId,
      });

      if (result.notFound) {
        return res.status(404).json({ error: 'Not Found', message: 'Inventory item not found.' });
      }

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: 'Validation Error', message: err.message });
      }
      return next(err);
    }
  },

  async listMovements(req, res, next) {
    try {
      const movements = await farmStore.listInventoryMovements(req.user._id, req.query);
      return res.status(200).json({
        success: true,
        count: movements.length,
        data: movements,
      });
    } catch (err) {
      return next(err);
    }
  },
});

export default createInventoryController();
