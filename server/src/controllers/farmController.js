import mongoose from 'mongoose';

const farmKeys = new Set(['name', 'location']);
const fieldKeys = new Set(['name', 'areaHectares', 'soilType', 'waterSource']);
const locationKeys = new Set(['region', 'country', 'city']);

const sendValidationError = (res, message) => res.status(400).json({
  error: 'Validation Error',
  message,
});

const validObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const validateName = (name) =>
  typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100;

const validateLocation = (location) =>
  validObject(location) &&
  Object.keys(location).every((key) => locationKeys.has(key)) &&
  Object.values(location).every((value) =>
    typeof value === 'string' && value.trim().length <= 100
  );

const validateFarm = (body, partial = false) => {
  if (!validObject(body) || !Object.keys(body).every((key) => farmKeys.has(key))) {
    return 'Provide only supported farm fields.';
  }
  if (!partial && !validateName(body.name)) return 'Farm name must contain 1 to 100 characters.';
  if (body.name !== undefined && !validateName(body.name)) {
    return 'Farm name must contain 1 to 100 characters.';
  }
  if (body.location !== undefined && !validateLocation(body.location)) {
    return 'Location must contain valid region, country, or city text.';
  }
  if (partial && !Object.keys(body).length) return 'At least one farm field is required.';
  return null;
};

const validateField = (body, partial = false) => {
  if (!validObject(body) || !Object.keys(body).every((key) => fieldKeys.has(key))) {
    return 'Provide only supported field details.';
  }
  if (!partial && !validateName(body.name)) return 'Field name must contain 1 to 100 characters.';
  if (body.name !== undefined && !validateName(body.name)) {
    return 'Field name must contain 1 to 100 characters.';
  }
  if (body.areaHectares !== undefined &&
      (!Number.isFinite(Number(body.areaHectares)) ||
       Number(body.areaHectares) <= 0 ||
       Number(body.areaHectares) > 1000000)) {
    return 'Field area must be a positive number no greater than 1,000,000 hectares.';
  }
  if (!partial && body.areaHectares === undefined) return 'Field area is required.';
  for (const key of ['soilType', 'waterSource']) {
    if (body[key] !== undefined &&
        (typeof body[key] !== 'string' || body[key].trim().length > 100)) {
      return `${key} must be text of at most 100 characters.`;
    }
  }
  if (partial && !Object.keys(body).length) return 'At least one field detail is required.';
  return null;
};

const cleanField = (body) => ({
  ...body,
  ...(body.name !== undefined ? { name: body.name.trim() } : {}),
  ...(body.areaHectares !== undefined ? { areaHectares: Number(body.areaHectares) } : {}),
  ...(body.soilType !== undefined ? { soilType: body.soilType.trim() } : {}),
  ...(body.waterSource !== undefined ? { waterSource: body.waterSource.trim() } : {}),
});

const getIdError = (id) => !mongoose.isValidObjectId(id);

export const createFarmController = (farmStore) => ({
  listFarms: async (req, res, next) => {
    try {
      const farms = await farmStore.listFarms(req.user._id || req.user.id);
      return res.json({ success: true, farms });
    } catch (error) {
      return next(error);
    }
  },

  createFarm: async (req, res, next) => {
    const validationError = validateFarm(req.body);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const farm = await farmStore.createFarm(req.user._id || req.user.id, {
        name: req.body.name.trim(),
        ...(req.body.location ? { location: cleanField(req.body.location) } : {}),
      });
      return res.status(201).json({ success: true, farm });
    } catch (error) {
      return next(error);
    }
  },

  getFarm: async (req, res, next) => {
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    try {
      const farm = await farmStore.findFarm(req.user._id || req.user.id, req.params.farmId);
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      return res.json({ success: true, farm });
    } catch (error) {
      return next(error);
    }
  },

  updateFarm: async (req, res, next) => {
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    const validationError = validateFarm(req.body, true);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const values = {
        ...(req.body.name !== undefined ? { name: req.body.name.trim() } : {}),
        ...(req.body.location !== undefined ? { location: cleanField(req.body.location) } : {}),
      };
      const farm = await farmStore.updateFarm(
        req.user._id || req.user.id,
        req.params.farmId,
        values
      );
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      return res.json({ success: true, farm });
    } catch (error) {
      return next(error);
    }
  },

  deleteFarm: async (req, res, next) => {
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    try {
      const result = await farmStore.deleteFarm(req.user._id || req.user.id, req.params.farmId);
      if (result.hasFields) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Delete this farm’s fields before deleting the farm.',
        });
      }
      if (!result.deleted) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },

  listFields: async (req, res, next) => {
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const farm = await farmStore.findFarm(ownerId, req.params.farmId);
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      const fields = await farmStore.listFields(ownerId, req.params.farmId);
      return res.json({ success: true, fields });
    } catch (error) {
      return next(error);
    }
  },

  createField: async (req, res, next) => {
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    const validationError = validateField(req.body);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const ownerId = req.user._id || req.user.id;
      const farm = await farmStore.findFarm(ownerId, req.params.farmId);
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      const field = await farmStore.createField(ownerId, req.params.farmId, cleanField(req.body));
      return res.status(201).json({ success: true, field });
    } catch (error) {
      return next(error);
    }
  },

  updateField: async (req, res, next) => {
    if (getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    const validationError = validateField(req.body, true);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const field = await farmStore.updateField(
        req.user._id || req.user.id,
        req.params.fieldId,
        cleanField(req.body)
      );
      if (!field) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });
      return res.json({ success: true, field });
    } catch (error) {
      return next(error);
    }
  },

  deleteField: async (req, res, next) => {
    if (getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const field = await farmStore.deleteField(req.user._id || req.user.id, req.params.fieldId);
      if (!field) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },
});

export default createFarmController;
