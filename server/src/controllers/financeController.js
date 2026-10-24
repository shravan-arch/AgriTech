import { farmStore as defaultFarmStore } from '../storage/farmStore.js';

export const createFinanceController = (farmStore = defaultFarmStore) => ({
  async listRecords(req, res, next) {
    try {
      const records = await farmStore.listFinanceRecords(req.user._id, req.query);
      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    } catch (err) {
      return next(err);
    }
  },

  async createRecord(req, res, next) {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    try {
      const { farmId, type, category, amount } = req.body;
      if (!farmId) {
        return res.status(400).json({ error: 'Validation Error', message: 'Farm ID is required.' });
      }
      if (!type || !['expense', 'revenue'].includes(type)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Valid type (expense or revenue) is required.' });
      }
      if (!category) {
        return res.status(400).json({ error: 'Validation Error', message: 'Category is required.' });
      }
      if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Amount must be a positive number.' });
      }

      const result = await farmStore.createFinanceRecord(req.user._id, req.body);
      if (result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: `${result.resource.charAt(0).toUpperCase() + result.resource.slice(1)} not found or not owned.`,
        });
      }

      return res.status(201).json({
        success: true,
        data: result.record,
      });
    } catch (err) {
      return next(err);
    }
  },

  async updateRecord(req, res, next) {
    try {
      const { type, amount } = req.body;
      if (type && !['expense', 'revenue'].includes(type)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Valid type (expense or revenue) is required.' });
      }
      if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Amount must be a positive number.' });
      }

      if (req.user && req.user.role === 'admin') {
        const records = await farmStore.listFinanceRecords(req.user._id, {});
        const match = records.find((r) => String(r._id) === String(req.params.id));
        if (!match) return res.status(404).json({ error: 'Not Found', message: 'Finance record not found.' });
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot modify financial records directly.',
        });
      }

      const result = await farmStore.updateFinanceRecord(req.user._id, req.params.id, req.body);
      if (!result) {
        return res.status(404).json({ error: 'Not Found', message: 'Finance record not found.' });
      }
      if (result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: `${result.resource.charAt(0).toUpperCase() + result.resource.slice(1)} not found or not owned.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.record,
      });
    } catch (err) {
      return next(err);
    }
  },

  async deleteRecord(req, res, next) {
    try {
      if (req.user && req.user.role === 'admin') {
        const records = await farmStore.listFinanceRecords(req.user._id, {});
        const match = records.find((r) => String(r._id) === String(req.params.id));
        if (!match) return res.status(404).json({ error: 'Not Found', message: 'Finance record not found.' });
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot delete financial records directly.',
        });
      }

      const deleted = await farmStore.deleteFinanceRecord(req.user._id, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Not Found', message: 'Finance record not found.' });
      }
      return res.status(200).json({
        success: true,
        message: 'Finance record deleted successfully.',
        data: deleted,
      });
    } catch (err) {
      return next(err);
    }
  },

  async getSummary(req, res, next) {
    try {
      const summary = await farmStore.getFinanceSummary(req.user._id, req.query);
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      return next(err);
    }
  },
});

export default createFinanceController();
