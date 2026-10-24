import mongoose from 'mongoose';
import multer from 'multer';
import { ACTIVITY_TYPES } from '../models/FarmActivity.js';
import { TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.js';
import { ALLOWED_PHOTO_MIME_TYPES } from '../models/FieldPhoto.js';
import photoStorage, { detectImageMimeType } from '../storage/photoStorage.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const photoUploadMiddleware = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'File size exceeds maximum allowed limit of 10MB.',
        });
      }
      return res.status(400).json({
        error: 'Validation Error',
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Upload error: ${err.message}`,
      });
    }
    next();
  });
};

const farmKeys = new Set(['name', 'location']);
const fieldKeys = new Set(['name', 'areaHectares', 'soilType', 'waterSource']);
const locationKeys = new Set(['region', 'country', 'city', 'latitude', 'longitude']);
const cropCycleKeys = new Set([
  'cropName',
  'variety',
  'season',
  'plantingDate',
  'expectedHarvestDate',
  'harvestDate',
  'stage',
  'status',
  'notes',
]);
const validStages = new Set([
  'sowing',
  'vegetative',
  'flowering',
  'ripening',
  'harvested',
  'dormant',
]);
const validStatuses = new Set(['active', 'completed', 'cancelled']);

const validActivityTypes = new Set(ACTIVITY_TYPES);
const validTaskTypes = new Set(TASK_TYPES);
const validTaskPriorities = new Set(TASK_PRIORITIES);
const validTaskStatuses = new Set(TASK_STATUSES);

const activityKeys = new Set([
  'type',
  'date',
  'notes',
  'inputs',
  'cost',
  'performedBy',
  'farmId',
  'fieldId',
  'cropCycleId',
]);

const taskKeys = new Set([
  'title',
  'type',
  'dueDate',
  'priority',
  'status',
  'notes',
  'assignee',
  'farmId',
  'fieldId',
  'cropCycleId',
  'completedAt',
]);

const sendValidationError = (res, message) => res.status(400).json({
  error: 'Validation Error',
  message,
});

const validObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const validateName = (name) =>
  typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100;

const validateLocation = (location) => {
  if (!validObject(location)) return false;
  if (!Object.keys(location).every((key) => locationKeys.has(key))) return false;
  for (const [key, value] of Object.entries(location)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'latitude') {
      const lat = Number(value);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return false;
    } else if (key === 'longitude') {
      const lon = Number(value);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) return false;
    } else {
      if (typeof value !== 'string' || value.trim().length > 100) return false;
    }
  }
  return true;
};

const cleanLocation = (loc) => {
  if (!loc) return undefined;
  const cleaned = {};
  if (loc.region !== undefined) cleaned.region = loc.region.trim();
  if (loc.country !== undefined) cleaned.country = loc.country.trim();
  if (loc.city !== undefined) cleaned.city = loc.city.trim();
  if (loc.latitude !== undefined && loc.latitude !== null && loc.latitude !== '') {
    cleaned.latitude = Number(loc.latitude);
  }
  if (loc.longitude !== undefined && loc.longitude !== null && loc.longitude !== '') {
    cleaned.longitude = Number(loc.longitude);
  }
  return cleaned;
};

const validateFarm = (body, partial = false) => {
  if (!validObject(body) || !Object.keys(body).every((key) => farmKeys.has(key))) {
    return 'Provide only supported farm fields.';
  }
  if (!partial && !validateName(body.name)) return 'Farm name must contain 1 to 100 characters.';
  if (body.name !== undefined && !validateName(body.name)) {
    return 'Farm name must contain 1 to 100 characters.';
  }
  if (body.location !== undefined && !validateLocation(body.location)) {
    return 'Location must contain valid region, country, city, or coordinates.';
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

const validateCropCycle = (body, partial = false) => {
  if (!validObject(body) || !Object.keys(body).every((key) => cropCycleKeys.has(key))) {
    return 'Provide only supported crop cycle fields.';
  }
  if (!partial && !validateName(body.cropName)) {
    return 'Crop name must contain 1 to 100 characters.';
  }
  if (body.cropName !== undefined && !validateName(body.cropName)) {
    return 'Crop name must contain 1 to 100 characters.';
  }
  for (const field of ['variety', 'season']) {
    if (body[field] !== undefined &&
        (typeof body[field] !== 'string' || body[field].trim().length > 100)) {
      return `${field} must be text of at most 100 characters.`;
    }
  }
  if (body.notes !== undefined &&
      (typeof body.notes !== 'string' || body.notes.trim().length > 1000)) {
    return 'Notes must be text of at most 1000 characters.';
  }
  if (!partial && body.plantingDate === undefined) {
    return 'Planting date is required.';
  }
  let plantingTime = null;
  if (body.plantingDate !== undefined) {
    const p = new Date(body.plantingDate);
    if (isNaN(p.getTime())) return 'Planting date must be a valid date.';
    plantingTime = p.getTime();
  }
  if (body.expectedHarvestDate !== undefined && body.expectedHarvestDate !== null && body.expectedHarvestDate !== '') {
    const exp = new Date(body.expectedHarvestDate);
    if (isNaN(exp.getTime())) return 'Expected harvest date must be a valid date.';
    if (plantingTime !== null && exp.getTime() < plantingTime) {
      return 'Expected harvest date cannot be earlier than planting date.';
    }
  }
  if (body.harvestDate !== undefined && body.harvestDate !== null && body.harvestDate !== '') {
    const h = new Date(body.harvestDate);
    if (isNaN(h.getTime())) return 'Harvest date must be a valid date.';
    if (plantingTime !== null && h.getTime() < plantingTime) {
      return 'Harvest date cannot be earlier than planting date.';
    }
  }
  if (body.stage !== undefined && !validStages.has(body.stage)) {
    return `Invalid crop stage: ${body.stage}.`;
  }
  if (body.status !== undefined && !validStatuses.has(body.status)) {
    return `Invalid crop status: ${body.status}.`;
  }
  if (partial && !Object.keys(body).length) {
    return 'At least one crop cycle field is required.';
  }
  return null;
};

const cleanCropCycle = (body) => ({
  ...body,
  ...(body.cropName !== undefined ? { cropName: body.cropName.trim() } : {}),
  ...(body.variety !== undefined ? { variety: body.variety.trim() } : {}),
  ...(body.season !== undefined ? { season: body.season.trim() } : {}),
  ...(body.notes !== undefined ? { notes: body.notes.trim() } : {}),
  ...(body.plantingDate !== undefined ? { plantingDate: new Date(body.plantingDate) } : {}),
  ...(body.expectedHarvestDate !== undefined
    ? { expectedHarvestDate: body.expectedHarvestDate ? new Date(body.expectedHarvestDate) : null }
    : {}),
  ...(body.harvestDate !== undefined
    ? { harvestDate: body.harvestDate ? new Date(body.harvestDate) : null }
    : {}),
});

const getIdError = (id) => !mongoose.isValidObjectId(id);

const validateTitle = (title) =>
  typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 200;

const validateActivity = (body, partial = false) => {
  if (!validObject(body) || !Object.keys(body).every((key) => activityKeys.has(key))) {
    return 'Provide only supported activity fields.';
  }
  if (!partial && !body.type) {
    return 'Activity type is required.';
  }
  if (body.type !== undefined && !validActivityTypes.has(body.type)) {
    return `Invalid activity type: ${body.type}.`;
  }
  if (!partial && body.date === undefined) {
    return 'Activity date is required.';
  }
  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (isNaN(d.getTime())) return 'Activity date must be a valid date.';
  }
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.trim().length > 1000)) {
    return 'Notes must be text of at most 1000 characters.';
  }
  if (body.performedBy !== undefined && (typeof body.performedBy !== 'string' || body.performedBy.trim().length > 100)) {
    return 'Performed by must be text of at most 100 characters.';
  }
  if (body.cost !== undefined && body.cost !== null && body.cost !== '') {
    const cost = Number(body.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return 'Cost must be a non-negative number.';
    }
  }
  if (body.inputs !== undefined && body.inputs !== null) {
    if (!Array.isArray(body.inputs)) {
      return 'Inputs must be an array of input items.';
    }
    for (const item of body.inputs) {
      if (!validObject(item)) return 'Each input item must be an object.';
      if (item.name !== undefined && (typeof item.name !== 'string' || item.name.trim().length > 100)) {
        return 'Input name must be text of at most 100 characters.';
      }
      if (item.quantity !== undefined && (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0)) {
        return 'Input quantity must be a non-negative number.';
      }
      if (item.unit !== undefined && (typeof item.unit !== 'string' || item.unit.trim().length > 30)) {
        return 'Input unit must be text of at most 30 characters.';
      }
    }
  }
  if (body.cropCycleId !== undefined && body.cropCycleId !== null && getIdError(body.cropCycleId)) {
    return 'Crop cycle ID is invalid.';
  }
  if (body.farmId !== undefined && body.farmId !== null && getIdError(body.farmId)) {
    return 'Farm ID is invalid.';
  }
  if (body.fieldId !== undefined && body.fieldId !== null && getIdError(body.fieldId)) {
    return 'Field ID is invalid.';
  }
  if (partial && !Object.keys(body).length) {
    return 'At least one activity field is required.';
  }
  return null;
};

const cleanActivity = (body) => ({
  ...body,
  ...(body.type !== undefined ? { type: body.type } : {}),
  ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
  ...(body.notes !== undefined ? { notes: body.notes.trim() } : {}),
  ...(body.performedBy !== undefined ? { performedBy: body.performedBy.trim() } : {}),
  ...(body.cost !== undefined && body.cost !== null && body.cost !== ''
    ? { cost: Number(body.cost) }
    : {}),
  ...(Array.isArray(body.inputs)
    ? {
        inputs: body.inputs.map((item) => ({
          name: (item.name || '').trim(),
          quantity: item.quantity !== undefined ? Number(item.quantity) : 0,
          unit: (item.unit || '').trim(),
        })),
      }
    : {}),
  ...(body.cropCycleId !== undefined ? { cropCycleId: body.cropCycleId || null } : {}),
});

const validateTask = (body, partial = false) => {
  if (!validObject(body) || !Object.keys(body).every((key) => taskKeys.has(key))) {
    return 'Provide only supported task fields.';
  }
  if (!partial && !validateTitle(body.title)) {
    return 'Task title must contain 1 to 200 characters.';
  }
  if (body.title !== undefined && !validateTitle(body.title)) {
    return 'Task title must contain 1 to 200 characters.';
  }
  if (!partial && body.dueDate === undefined) {
    return 'Task due date is required.';
  }
  if (body.dueDate !== undefined) {
    const d = new Date(body.dueDate);
    if (isNaN(d.getTime())) return 'Task due date must be a valid date.';
  }
  if (body.type !== undefined && !validTaskTypes.has(body.type)) {
    return `Invalid task type: ${body.type}.`;
  }
  if (body.priority !== undefined && !validTaskPriorities.has(body.priority)) {
    return `Invalid task priority: ${body.priority}.`;
  }
  if (body.status !== undefined && !validTaskStatuses.has(body.status)) {
    return `Invalid task status: ${body.status}.`;
  }
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.trim().length > 1000)) {
    return 'Notes must be text of at most 1000 characters.';
  }
  if (body.assignee !== undefined && (typeof body.assignee !== 'string' || body.assignee.trim().length > 100)) {
    return 'Assignee must be text of at most 100 characters.';
  }
  if (body.farmId !== undefined && body.farmId !== null && getIdError(body.farmId)) {
    return 'Farm ID is invalid.';
  }
  if (body.fieldId !== undefined && body.fieldId !== null && getIdError(body.fieldId)) {
    return 'Field ID is invalid.';
  }
  if (body.cropCycleId !== undefined && body.cropCycleId !== null && getIdError(body.cropCycleId)) {
    return 'Crop cycle ID is invalid.';
  }
  if (partial && !Object.keys(body).length) {
    return 'At least one task field is required.';
  }
  return null;
};

const cleanTask = (body) => ({
  ...body,
  ...(body.title !== undefined ? { title: body.title.trim() } : {}),
  ...(body.dueDate !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
  ...(body.notes !== undefined ? { notes: body.notes.trim() } : {}),
  ...(body.assignee !== undefined ? { assignee: body.assignee.trim() } : {}),
  ...(body.farmId !== undefined ? { farmId: body.farmId || null } : {}),
  ...(body.fieldId !== undefined ? { fieldId: body.fieldId || null } : {}),
  ...(body.cropCycleId !== undefined ? { cropCycleId: body.cropCycleId || null } : {}),
});

export const createFarmController = (farmStore, activePhotoStorage = photoStorage) => ({
  photoUploadMiddleware,
  listFarms: async (req, res, next) => {
    try {
      const farms = await farmStore.listFarms(req.user._id || req.user.id);
      return res.json({ success: true, farms });
    } catch (error) {
      return next(error);
    }
  },

  createFarm: async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    const validationError = validateFarm(req.body);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const farm = await farmStore.createFarm(req.user._id || req.user.id, {
        name: req.body.name.trim(),
        ...(req.body.location ? { location: cleanLocation(req.body.location) } : {}),
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
      const ownerId = req.user._id || req.user.id;
      if (req.user && req.user.role === 'admin') {
        const farm = await farmStore.findFarm(ownerId, req.params.farmId);
        if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot modify their own farm data directly. Changes must be performed by another administrator.',
        });
      }

      const values = {
        ...(req.body.name !== undefined ? { name: req.body.name.trim() } : {}),
        ...(req.body.location !== undefined ? { location: cleanLocation(req.body.location) } : {}),
      };
      const farm = await farmStore.updateFarm(
        ownerId,
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
      const ownerId = req.user._id || req.user.id;
      if (req.user && req.user.role === 'admin') {
        const farm = await farmStore.findFarm(ownerId, req.params.farmId);
        if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot delete their own farm data directly. Changes must be performed by another administrator.',
        });
      }

      const result = await farmStore.deleteFarm(ownerId, req.params.farmId);
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
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
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
      const ownerId = req.user._id || req.user.id;
      if (req.user && req.user.role === 'admin') {
        const existing = typeof farmStore.findField === 'function'
          ? await farmStore.findField(ownerId, req.params.fieldId)
          : null;
        if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot modify their own field data directly. Changes must be performed by another administrator.',
        });
      }

      const field = await farmStore.updateField(
        ownerId,
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
      const ownerId = req.user._id || req.user.id;
      if (req.user && req.user.role === 'admin') {
        const existing = typeof farmStore.findField === 'function'
          ? await farmStore.findField(ownerId, req.params.fieldId)
          : null;
        if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });
        return res.status(403).json({
          error: 'Forbidden',
          code: 'ADMIN_WRITE_RESTRICTED',
          message: 'Administrators cannot delete their own field data directly. Changes must be performed by another administrator.',
        });
      }

      const field = await farmStore.deleteField(ownerId, req.params.fieldId);
      if (!field) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },

  listAllCropCycles: async (req, res, next) => {
    try {
      const ownerId = req.user._id || req.user.id;
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.farmId) {
        if (getIdError(req.query.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
        filters.farmId = req.query.farmId;
      }
      if (req.query.fieldId) {
        if (getIdError(req.query.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
        filters.fieldId = req.query.fieldId;
      }
      const cropCycles = await farmStore.listCropCycles(ownerId, filters);
      return res.json({ success: true, cropCycles });
    } catch (error) {
      return next(error);
    }
  },

  listFieldCropCycles: async (req, res, next) => {
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const farm = await farmStore.findFarm(ownerId, req.params.farmId);
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      const fields = await farmStore.listFields(ownerId, req.params.farmId);
      const field = fields.find((f) => String(f._id || f.id) === String(req.params.fieldId));
      if (!field) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });

      const cropCycles = await farmStore.listCropCycles(ownerId, {
        farmId: req.params.farmId,
        fieldId: req.params.fieldId,
        status: req.query.status,
      });
      return res.json({ success: true, cropCycles });
    } catch (error) {
      return next(error);
    }
  },

  createCropCycle: async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    if (getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    const validationError = validateCropCycle(req.body);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const ownerId = req.user._id || req.user.id;
      const result = await farmStore.createCropCycle(
        ownerId,
        req.params.farmId,
        req.params.fieldId,
        cleanCropCycle(req.body)
      );
      if (result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: result.resource === 'farm' ? 'Farm not found.' : 'Field not found on this farm.',
        });
      }
      if (result.conflict) {
        return res.status(409).json({ error: 'Conflict', message: result.message });
      }
      return res.status(201).json({ success: true, cropCycle: result.cycle });
    } catch (error) {
      return next(error);
    }
  },

  getCropCycle: async (req, res, next) => {
    const cycleId = req.params.cycleId;
    if (getIdError(cycleId)) return sendValidationError(res, 'Crop cycle ID is invalid.');
    if (req.params.farmId && getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (req.params.fieldId && getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const cropCycle = await farmStore.findCropCycle(ownerId, cycleId, {
        farmId: req.params.farmId,
        fieldId: req.params.fieldId,
      });
      if (!cropCycle) return res.status(404).json({ error: 'Not Found', message: 'Crop cycle not found.' });
      return res.json({ success: true, cropCycle });
    } catch (error) {
      return next(error);
    }
  },

  updateCropCycle: async (req, res, next) => {
    const cycleId = req.params.cycleId;
    if (getIdError(cycleId)) return sendValidationError(res, 'Crop cycle ID is invalid.');
    if (req.params.farmId && getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (req.params.fieldId && getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    const validationError = validateCropCycle(req.body, true);
    if (validationError) return sendValidationError(res, validationError);
    try {
      const ownerId = req.user._id || req.user.id;
      const existing = await farmStore.findCropCycle(ownerId, cycleId, {
        farmId: req.params.farmId,
        fieldId: req.params.fieldId,
      });
      if (!existing) return res.status(404).json({ error: 'Not Found', message: 'Crop cycle not found.' });

      const effectivePlanting = req.body.plantingDate !== undefined
        ? new Date(req.body.plantingDate)
        : new Date(existing.plantingDate);

      if (req.body.expectedHarvestDate) {
        if (new Date(req.body.expectedHarvestDate) < effectivePlanting) {
          return sendValidationError(res, 'Expected harvest date cannot be earlier than planting date.');
        }
      }
      if (req.body.harvestDate) {
        if (new Date(req.body.harvestDate) < effectivePlanting) {
          return sendValidationError(res, 'Harvest date cannot be earlier than planting date.');
        }
      }

      const result = await farmStore.updateCropCycle(
        ownerId,
        cycleId,
        cleanCropCycle(req.body),
        { farmId: req.params.farmId, fieldId: req.params.fieldId }
      );
      if (result?.conflict) {
        return res.status(409).json({ error: 'Conflict', message: result.message });
      }
      if (!result || !result.cycle) {
        return res.status(404).json({ error: 'Not Found', message: 'Crop cycle not found.' });
      }
      return res.json({ success: true, cropCycle: result.cycle });
    } catch (error) {
      return next(error);
    }
  },

  deleteCropCycle: async (req, res, next) => {
    const cycleId = req.params.cycleId;
    if (getIdError(cycleId)) return sendValidationError(res, 'Crop cycle ID is invalid.');
    if (req.params.farmId && getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (req.params.fieldId && getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const cropCycle = await farmStore.deleteCropCycle(ownerId, cycleId, {
        farmId: req.params.farmId,
        fieldId: req.params.fieldId,
      });
      if (!cropCycle) return res.status(404).json({ error: 'Not Found', message: 'Crop cycle not found.' });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },

  // Activities handlers
  listActivities: async (req, res, next) => {
    try {
      const ownerId = req.user._id || req.user.id;
      const filters = {};
      if (req.query.farmId) {
        if (getIdError(req.query.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
        filters.farmId = req.query.farmId;
      }
      if (req.query.fieldId) {
        if (getIdError(req.query.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
        filters.fieldId = req.query.fieldId;
      }
      if (req.query.cropCycleId) {
        if (getIdError(req.query.cropCycleId)) return sendValidationError(res, 'Crop cycle ID is invalid.');
        filters.cropCycleId = req.query.cropCycleId;
      }
      if (req.query.type) {
        if (!validActivityTypes.has(req.query.type)) return sendValidationError(res, 'Invalid activity type.');
        filters.type = req.query.type;
      }
      if (req.query.startDate) filters.startDate = req.query.startDate;
      if (req.query.endDate) filters.endDate = req.query.endDate;
      if (req.query.limit) filters.limit = req.query.limit;

      const activities = await farmStore.listActivities(ownerId, filters);
      return res.json({ success: true, activities });
    } catch (error) {
      return next(error);
    }
  },

  listFieldActivities: async (req, res, next) => {
    const { farmId, fieldId } = req.params;
    if (getIdError(farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (getIdError(fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const farm = await farmStore.findFarm(ownerId, farmId);
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      const field = (await farmStore.listFields(ownerId, farmId)).find((f) => String(f._id) === String(fieldId));
      if (!field) return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });

      const filters = { farmId, fieldId };
      if (req.query.cropCycleId) {
        if (getIdError(req.query.cropCycleId)) return sendValidationError(res, 'Crop cycle ID is invalid.');
        filters.cropCycleId = req.query.cropCycleId;
      }
      if (req.query.type) {
        if (!validActivityTypes.has(req.query.type)) return sendValidationError(res, 'Invalid activity type.');
        filters.type = req.query.type;
      }
      if (req.query.limit) filters.limit = req.query.limit;

      const activities = await farmStore.listActivities(ownerId, filters);
      return res.json({ success: true, activities });
    } catch (error) {
      return next(error);
    }
  },

  createActivity: async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    const farmId = req.params.farmId || req.body.farmId;
    const fieldId = req.params.fieldId || req.body.fieldId;
    if (!farmId || getIdError(farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (!fieldId || getIdError(fieldId)) return sendValidationError(res, 'Field ID is invalid.');

    const validationError = validateActivity(req.body);
    if (validationError) return sendValidationError(res, validationError);

    try {
      const ownerId = req.user._id || req.user.id;
      const result = await farmStore.createActivity(ownerId, farmId, fieldId, cleanActivity(req.body));
      if (result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message:
            result.resource === 'farm'
              ? 'Farm not found.'
              : result.resource === 'field'
              ? 'Field not found on this farm.'
              : 'Crop cycle not found on this field.',
        });
      }
      return res.status(201).json({ success: true, activity: result.activity });
    } catch (error) {
      return next(error);
    }
  },

  getActivity: async (req, res, next) => {
    const activityId = req.params.activityId;
    if (getIdError(activityId)) return sendValidationError(res, 'Activity ID is invalid.');
    if (req.params.farmId && getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (req.params.fieldId && getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const activity = await farmStore.findActivity(ownerId, activityId, {
        farmId: req.params.farmId,
        fieldId: req.params.fieldId,
      });
      if (!activity) return res.status(404).json({ error: 'Not Found', message: 'Activity not found.' });
      return res.json({ success: true, activity });
    } catch (error) {
      return next(error);
    }
  },

  updateActivity: async (req, res, next) => {
    const activityId = req.params.activityId;
    if (getIdError(activityId)) return sendValidationError(res, 'Activity ID is invalid.');
    if (req.params.farmId && getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (req.params.fieldId && getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    const validationError = validateActivity(req.body, true);
    if (validationError) return sendValidationError(res, validationError);

    try {
      const ownerId = req.user._id || req.user.id;
      const result = await farmStore.updateActivity(
        ownerId,
        activityId,
        cleanActivity(req.body),
        { farmId: req.params.farmId, fieldId: req.params.fieldId }
      );
      if (!result || result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: result?.resource === 'cropCycle' ? 'Crop cycle not found on this field.' : 'Activity not found.',
        });
      }
      return res.json({ success: true, activity: result.activity });
    } catch (error) {
      return next(error);
    }
  },

  deleteActivity: async (req, res, next) => {
    const activityId = req.params.activityId;
    if (getIdError(activityId)) return sendValidationError(res, 'Activity ID is invalid.');
    if (req.params.farmId && getIdError(req.params.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (req.params.fieldId && getIdError(req.params.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const activity = await farmStore.deleteActivity(ownerId, activityId, {
        farmId: req.params.farmId,
        fieldId: req.params.fieldId,
      });
      if (!activity) return res.status(404).json({ error: 'Not Found', message: 'Activity not found.' });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },

  // Tasks handlers
  listTasks: async (req, res, next) => {
    try {
      const ownerId = req.user._id || req.user.id;
      const filters = {};
      if (req.query.farmId) {
        if (getIdError(req.query.farmId)) return sendValidationError(res, 'Farm ID is invalid.');
        filters.farmId = req.query.farmId;
      }
      if (req.query.fieldId) {
        if (getIdError(req.query.fieldId)) return sendValidationError(res, 'Field ID is invalid.');
        filters.fieldId = req.query.fieldId;
      }
      if (req.query.cropCycleId) {
        if (getIdError(req.query.cropCycleId)) return sendValidationError(res, 'Crop cycle ID is invalid.');
        filters.cropCycleId = req.query.cropCycleId;
      }
      if (req.query.status) {
        if (!validTaskStatuses.has(req.query.status)) return sendValidationError(res, 'Invalid task status.');
        filters.status = req.query.status;
      }
      if (req.query.priority) {
        if (!validTaskPriorities.has(req.query.priority)) return sendValidationError(res, 'Invalid task priority.');
        filters.priority = req.query.priority;
      }
      if (req.query.type) {
        if (!validTaskTypes.has(req.query.type)) return sendValidationError(res, 'Invalid task type.');
        filters.type = req.query.type;
      }
      if (req.query.due) {
        if (!['today', 'overdue', 'upcoming'].includes(req.query.due)) {
          return sendValidationError(res, 'Invalid due filter: must be today, overdue, or upcoming.');
        }
        filters.due = req.query.due;
      }
      if (req.query.limit) filters.limit = req.query.limit;

      const tasks = await farmStore.listTasks(ownerId, filters);
      return res.json({ success: true, tasks });
    } catch (error) {
      return next(error);
    }
  },

  createTask: async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    const validationError = validateTask(req.body);
    if (validationError) return sendValidationError(res, validationError);

    try {
      const ownerId = req.user._id || req.user.id;
      const result = await farmStore.createTask(ownerId, cleanTask(req.body));
      if (result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message:
            result.resource === 'farm'
              ? 'Farm not found.'
              : result.resource === 'field'
              ? 'Field not found.'
              : 'Crop cycle not found.',
        });
      }
      return res.status(201).json({ success: true, task: result.task });
    } catch (error) {
      return next(error);
    }
  },

  getTask: async (req, res, next) => {
    const taskId = req.params.taskId;
    if (getIdError(taskId)) return sendValidationError(res, 'Task ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const task = await farmStore.findTask(ownerId, taskId);
      if (!task) return res.status(404).json({ error: 'Not Found', message: 'Task not found.' });
      return res.json({ success: true, task });
    } catch (error) {
      return next(error);
    }
  },

  updateTask: async (req, res, next) => {
    const taskId = req.params.taskId;
    if (getIdError(taskId)) return sendValidationError(res, 'Task ID is invalid.');
    const validationError = validateTask(req.body, true);
    if (validationError) return sendValidationError(res, validationError);

    try {
      const ownerId = req.user._id || req.user.id;
      const result = await farmStore.updateTask(ownerId, taskId, cleanTask(req.body));
      if (!result || result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: result?.resource
            ? `${result.resource.charAt(0).toUpperCase() + result.resource.slice(1)} not found.`
            : 'Task not found.',
        });
      }
      return res.json({ success: true, task: result.task });
    } catch (error) {
      return next(error);
    }
  },

  completeTask: async (req, res, next) => {
    const taskId = req.params.taskId;
    if (getIdError(taskId)) return sendValidationError(res, 'Task ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const result = await farmStore.updateTask(ownerId, taskId, {
        status: 'completed',
        completedAt: new Date(),
      });
      if (!result || result.notFound) {
        return res.status(404).json({ error: 'Not Found', message: 'Task not found.' });
      }
      return res.json({ success: true, task: result.task });
    } catch (error) {
      return next(error);
    }
  },

  deleteTask: async (req, res, next) => {
    const taskId = req.params.taskId;
    if (getIdError(taskId)) return sendValidationError(res, 'Task ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const task = await farmStore.deleteTask(ownerId, taskId);
      if (!task) return res.status(404).json({ error: 'Not Found', message: 'Task not found.' });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },

  // FieldPhoto endpoints
  listPhotos: async (req, res, next) => {
    try {
      const ownerId = req.user._id || req.user.id;
      const filters = {};
      if (req.query.farmId) filters.farmId = req.query.farmId;
      if (req.query.fieldId) filters.fieldId = req.query.fieldId;
      if (req.query.cropCycleId) filters.cropCycleId = req.query.cropCycleId;
      if (req.params.farmId) filters.farmId = req.params.farmId;
      if (req.params.fieldId) filters.fieldId = req.params.fieldId;

      const photos = await farmStore.listPhotos(ownerId, filters);
      return res.json({ success: true, photos });
    } catch (error) {
      return next(error);
    }
  },

  listFieldPhotos: async (req, res, next) => {
    const { farmId, fieldId } = req.params;
    if (getIdError(farmId)) return sendValidationError(res, 'Farm ID is invalid.');
    if (getIdError(fieldId)) return sendValidationError(res, 'Field ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const farm = await farmStore.findFarm(ownerId, farmId);
      if (!farm) return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });

      const fields = await farmStore.listFields(ownerId, farmId);
      const field = fields.find((f) => String(f._id) === String(fieldId));
      if (!field) {
        return res.status(404).json({ error: 'Not Found', message: 'Field not found.' });
      }

      const filters = { farmId, fieldId };
      if (req.query.cropCycleId) filters.cropCycleId = req.query.cropCycleId;

      const photos = await farmStore.listPhotos(ownerId, filters);
      return res.json({ success: true, photos });
    } catch (error) {
      return next(error);
    }
  },

  uploadPhoto: async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'ADMIN_WRITE_RESTRICTED',
        message: 'Administrators manage the platform and users; they cannot create personal agricultural resources or workspaces.',
      });
    }
    try {
      const ownerId = req.user._id || req.user.id;
      if (!req.file || !req.file.buffer) {
        return sendValidationError(res, 'Photograph image file is required.');
      }
      if (req.file.size === 0) {
        return sendValidationError(res, 'Uploaded image file cannot be empty.');
      }

      // Requirement 4: Validate file size, MIME type, extension, and upload errors.
      // Do not trust client-supplied filenames or content types alone.
      const detectedMime = detectImageMimeType(req.file.buffer);
      if (!detectedMime || !ALLOWED_PHOTO_MIME_TYPES.includes(detectedMime)) {
        return sendValidationError(
          res,
          'Invalid image format: magic bytes do not match JPEG, PNG, or WebP.'
        );
      }

      const farmId = req.params.farmId || req.body.farmId;
      const fieldId = req.params.fieldId || req.body.fieldId;
      const cropCycleId = req.body.cropCycleId || undefined;
      const notes = req.body.notes !== undefined ? String(req.body.notes).trim() : undefined;
      const capturedAt = req.body.capturedAt || undefined;

      if (!farmId || getIdError(farmId)) {
        return sendValidationError(res, 'Valid Farm ID is required.');
      }
      if (!fieldId || getIdError(fieldId)) {
        return sendValidationError(res, 'Valid Field ID is required.');
      }
      if (cropCycleId && getIdError(cropCycleId)) {
        return sendValidationError(res, 'Crop cycle ID is invalid.');
      }
      if (capturedAt && isNaN(new Date(capturedAt).getTime())) {
        return sendValidationError(res, 'Captured date must be a valid date.');
      }
      if (notes && notes.length > 1000) {
        return sendValidationError(res, 'Observation notes cannot exceed 1000 characters.');
      }

      let saved;
      try {
        saved = await activePhotoStorage.savePhoto({
          buffer: req.file.buffer,
          ownerId,
        });
      } catch (storageError) {
        return res.status(500).json({
          error: 'Storage Failure',
          message: storageError.message || 'Failed to save photograph file.',
        });
      }

      try {
        const result = await farmStore.createPhoto(ownerId, {
          farmId,
          fieldId,
          cropCycleId: cropCycleId || undefined,
          storageProvider: saved.storageProvider,
          storageKey: saved.storageKey,
          originalFilename: req.file.originalname
            ? String(req.file.originalname).slice(0, 255)
            : 'photo.jpg',
          mimeType: saved.mimeType,
          fileSize: req.file.size,
          capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
          notes: notes || undefined,
        });

        if (result.notFound) {
          await activePhotoStorage
            .deletePhoto({
              storageKey: saved.storageKey,
              storageProvider: saved.storageProvider,
            })
            .catch(() => {});
          return res.status(404).json({
            error: 'Not Found',
            message: `${result.resource.charAt(0).toUpperCase() + result.resource.slice(1)} not found.`,
          });
        }

        return res.status(201).json({ success: true, photo: result.photo });
      } catch (dbError) {
        await activePhotoStorage
          .deletePhoto({
            storageKey: saved.storageKey,
            storageProvider: saved.storageProvider,
          })
          .catch(() => {});
        throw dbError;
      }
    } catch (error) {
      return next(error);
    }
  },

  getPhoto: async (req, res, next) => {
    const photoId = req.params.photoId;
    if (getIdError(photoId)) return sendValidationError(res, 'Photo ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const options = {};
      if (req.params.farmId) options.farmId = req.params.farmId;
      if (req.params.fieldId) options.fieldId = req.params.fieldId;

      const photo = await farmStore.findPhoto(ownerId, photoId, options);
      if (!photo) {
        return res.status(404).json({ error: 'Not Found', message: 'Photograph not found.' });
      }
      return res.json({ success: true, photo });
    } catch (error) {
      return next(error);
    }
  },

  getPhotoFile: async (req, res, next) => {
    const photoId = req.params.photoId;
    if (getIdError(photoId)) return sendValidationError(res, 'Photo ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const options = {};
      if (req.params.farmId) options.farmId = req.params.farmId;
      if (req.params.fieldId) options.fieldId = req.params.fieldId;

      const photo = await farmStore.findPhoto(ownerId, photoId, options);
      if (!photo) {
        return res.status(404).json({ error: 'Not Found', message: 'Photograph not found.' });
      }

      try {
        const buffer = await activePhotoStorage.getPhoto({
          storageKey: photo.storageKey,
          storageProvider: photo.storageProvider,
        });
        if (!buffer) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Photograph file data is unavailable on storage.',
          });
        }

        res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(buffer);
      } catch (storageError) {
        return res.status(500).json({
          error: 'Storage Failure',
          message: storageError.message || 'Failed to retrieve photograph file.',
        });
      }
    } catch (error) {
      return next(error);
    }
  },

  updatePhoto: async (req, res, next) => {
    const photoId = req.params.photoId;
    if (getIdError(photoId)) return sendValidationError(res, 'Photo ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const options = {};
      if (req.params.farmId) options.farmId = req.params.farmId;
      if (req.params.fieldId) options.fieldId = req.params.fieldId;

      if (req.body.cropCycleId && getIdError(req.body.cropCycleId)) {
        return sendValidationError(res, 'Crop cycle ID is invalid.');
      }
      if (req.body.capturedAt && isNaN(new Date(req.body.capturedAt).getTime())) {
        return sendValidationError(res, 'Captured date must be a valid date.');
      }
      if (
        req.body.notes !== undefined &&
        typeof req.body.notes === 'string' &&
        req.body.notes.length > 1000
      ) {
        return sendValidationError(res, 'Observation notes cannot exceed 1000 characters.');
      }

      const updates = {};
      if (req.body.notes !== undefined) updates.notes = String(req.body.notes).trim();
      if (req.body.capturedAt !== undefined) updates.capturedAt = new Date(req.body.capturedAt);
      if (req.body.cropCycleId !== undefined) updates.cropCycleId = req.body.cropCycleId || null;

      const result = await farmStore.updatePhoto(ownerId, photoId, updates, options);
      if (!result || result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: result?.resource
            ? `${result.resource.charAt(0).toUpperCase() + result.resource.slice(1)} not found.`
            : 'Photograph not found.',
        });
      }

      return res.json({ success: true, photo: result.photo });
    } catch (error) {
      return next(error);
    }
  },

  deletePhoto: async (req, res, next) => {
    const photoId = req.params.photoId;
    if (getIdError(photoId)) return sendValidationError(res, 'Photo ID is invalid.');
    try {
      const ownerId = req.user._id || req.user.id;
      const options = {};
      if (req.params.farmId) options.farmId = req.params.farmId;
      if (req.params.fieldId) options.fieldId = req.params.fieldId;

      const photo = await farmStore.deletePhoto(ownerId, photoId, options);
      if (!photo) return res.status(404).json({ error: 'Not Found', message: 'Photograph not found.' });
      return res.json({ success: true, message: 'Photograph deleted successfully.' });
    } catch (error) {
      return next(error);
    }
  },
});

export default createFarmController;
