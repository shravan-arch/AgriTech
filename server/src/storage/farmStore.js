import Farm from '../models/Farm.js';
import Field from '../models/Field.js';
import CropCycle from '../models/CropCycle.js';
import FarmActivity from '../models/FarmActivity.js';
import Task from '../models/Task.js';
import FieldPhoto from '../models/FieldPhoto.js';
import FinanceRecord from '../models/FinanceRecord.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryMovement from '../models/InventoryMovement.js';
import Sensor from '../models/Sensor.js';
import SensorReading from '../models/SensorReading.js';
import Notification from '../models/Notification.js';
import WeatherSnapshot from '../models/WeatherSnapshot.js';
import photoStorage from './photoStorage.js';
import { getDBStatus } from '../config/db.js';
import { newLocalId, readLocalCollection, writeLocalCollection } from './localJsonStore.js';
import { ownedResourceFilter } from './ownershipQueries.js';

const getStorageMode = () => getDBStatus().mode;
const unavailableError = () => new Error('Persistent storage is unavailable.');
const toRecord = (document) => JSON.parse(JSON.stringify(document));

const validateLocalDocument = async (Model, record) => {
  const document = new Model(record);
  await document.validate();
  return toRecord(document);
};

export const farmStore = {
  async listFarms(ownerId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Farm.find({ ownerId }).sort({ createdAt: -1 });
    if (mode !== 'local-json-development') throw unavailableError();
    return readLocalCollection('farms')
      .filter((farm) => farm.ownerId === String(ownerId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  async listAllFarmsWithCoordinates() {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Farm.find({
        'location.latitude': { $ne: null },
        'location.longitude': { $ne: null },
      });
    }
    if (mode !== 'local-json-development') return [];
    return readLocalCollection('farms').filter(
      (f) => f.location?.latitude != null && f.location?.longitude != null
    );
  },

  async listAllFarmsAdmin(filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = {};
      if (filters.ownerId) query.ownerId = filters.ownerId;
      const farms = await Farm.find(query).populate('ownerId', 'name email role status phone location').sort({ createdAt: -1 });
      const farmIds = farms.map((f) => f._id);
      const fields = await Field.find({ farmId: { $in: farmIds } }).sort({ createdAt: -1 });
      const fieldMap = new Map();
      for (const field of fields) {
        const key = String(field.farmId);
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        fieldMap.get(key).push(field);
      }
      return farms.map((f) => {
        const obj = f.toObject ? f.toObject() : f;
        obj.fields = fieldMap.get(String(f._id)) || [];
        return obj;
      });
    }
    if (mode !== 'local-json-development') return [];
    const farms = readLocalCollection('farms');
    const fields = readLocalCollection('fields');
    const users = readLocalCollection('users');
    const userMap = new Map(users.map((u) => [String(u._id || u.id), u]));
    let filteredFarms = farms;
    if (filters.ownerId) {
      filteredFarms = farms.filter((f) => String(f.ownerId) === String(filters.ownerId));
    }
    return filteredFarms.map((f) => {
      const owner = userMap.get(String(f.ownerId)) || null;
      const flds = fields.filter((fld) => String(fld.farmId) === String(f._id));
      return {
        ...f,
        ownerId: owner
          ? { _id: owner._id, name: owner.name, email: owner.email, role: owner.role, status: owner.status }
          : f.ownerId,
        fields: flds,
      };
    });
  },

  async createFarm(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Farm.create({ ...values, ownerId });
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date().toISOString();
    const record = await validateLocalDocument(Farm, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      createdAt: now,
      updatedAt: now,
    });
    const farms = readLocalCollection('farms');
    farms.push(record);
    writeLocalCollection('farms', farms);
    return record;
  },

  async findFarm(ownerId, farmId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Farm.findOne(ownedResourceFilter(farmId, ownerId));
    if (mode !== 'local-json-development') throw unavailableError();
    return readLocalCollection('farms').find(
      (farm) => farm._id === farmId && farm.ownerId === String(ownerId)
    ) || null;
  },

  async updateFarm(ownerId, farmId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Farm.findOneAndUpdate(
        ownedResourceFilter(farmId, ownerId),
        { $set: values },
        { new: true, runValidators: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const index = farms.findIndex(
      (farm) => farm._id === farmId && farm.ownerId === String(ownerId)
    );
    if (index === -1) return null;
    const record = await validateLocalDocument(Farm, {
      ...farms[index],
      ...values,
      updatedAt: new Date().toISOString(),
    });
    farms[index] = record;
    writeLocalCollection('farms', farms);
    return record;
  },

  async deleteFarm(ownerId, farmId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne(ownedResourceFilter(farmId, ownerId));
      if (!farm) return { deleted: false, hasFields: false };
      if (await Field.exists({ ownerId, farmId })) {
        return { deleted: false, hasFields: true };
      }
      await Farm.deleteOne(ownedResourceFilter(farmId, ownerId));
      await Task.deleteMany({ ownerId, farmId });
      return { deleted: true, hasFields: false };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find(
      (item) => item._id === farmId && item.ownerId === String(ownerId)
    );
    if (!farm) return { deleted: false, hasFields: false };
    if (readLocalCollection('fields').some(
      (field) => field.ownerId === String(ownerId) && field.farmId === farmId
    )) {
      return { deleted: false, hasFields: true };
    }
    writeLocalCollection('farms', farms.filter((item) => item._id !== farmId));
    writeLocalCollection(
      'tasks',
      readLocalCollection('tasks').filter(
        (task) => !(task.ownerId === String(ownerId) && task.farmId === farmId)
      )
    );
    return { deleted: true, hasFields: false };
  },

  async listFields(ownerId, farmId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Field.find({ ownerId, farmId }).sort({ createdAt: -1 });
    if (mode !== 'local-json-development') throw unavailableError();
    return readLocalCollection('fields')
      .filter((field) => field.ownerId === String(ownerId) && field.farmId === farmId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  async createField(ownerId, farmId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Field.create({ ...values, ownerId, farmId });
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date().toISOString();
    const record = await validateLocalDocument(Field, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      farmId: String(farmId),
      createdAt: now,
      updatedAt: now,
    });
    const fields = readLocalCollection('fields');
    fields.push(record);
    writeLocalCollection('fields', fields);
    return record;
  },

  async findField(ownerId, fieldId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Field.findOne(ownedResourceFilter(fieldId, ownerId));
    if (mode !== 'local-json-development') throw unavailableError();
    return readLocalCollection('fields').find(
      (field) => (field._id === fieldId || field.id === fieldId) && field.ownerId === String(ownerId)
    ) || null;
  },

  async updateField(ownerId, fieldId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Field.findOneAndUpdate(
        ownedResourceFilter(fieldId, ownerId),
        { $set: values },
        { new: true, runValidators: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const fields = readLocalCollection('fields');
    const index = fields.findIndex(
      (field) => field._id === fieldId && field.ownerId === String(ownerId)
    );
    if (!index && index !== 0) return null;
    if (index === -1) return null;
    const record = await validateLocalDocument(Field, {
      ...fields[index],
      ...values,
      updatedAt: new Date().toISOString(),
    });
    fields[index] = record;
    writeLocalCollection('fields', fields);
    return record;
  },

  async deleteField(ownerId, fieldId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const field = await Field.findOneAndDelete(ownedResourceFilter(fieldId, ownerId));
      if (field) {
        const photos = await FieldPhoto.find({ ownerId, fieldId });
        await Promise.all(
          photos.map((p) =>
            photoStorage.deletePhoto({ storageKey: p.storageKey, storageProvider: p.storageProvider }).catch(() => {})
          )
        );
        await Promise.all([
          CropCycle.deleteMany({ ownerId, fieldId }),
          FarmActivity.deleteMany({ ownerId, fieldId }),
          Task.deleteMany({ ownerId, fieldId }),
          FieldPhoto.deleteMany({ ownerId, fieldId }),
        ]);
      }
      return field;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const fields = readLocalCollection('fields');
    const field = fields.find(
      (item) => item._id === fieldId && item.ownerId === String(ownerId)
    );
    if (!field) return null;
    const allPhotos = readLocalCollection('field_photos');
    const photosToDelete = allPhotos.filter(
      (p) => p.ownerId === String(ownerId) && p.fieldId === fieldId
    );
    await Promise.all(
      photosToDelete.map((p) =>
        photoStorage.deletePhoto({ storageKey: p.storageKey, storageProvider: p.storageProvider }).catch(() => {})
      )
    );
    writeLocalCollection('fields', fields.filter((item) => item._id !== fieldId));
    writeLocalCollection(
      'crop_cycles',
      readLocalCollection('crop_cycles').filter(
        (cycle) => !(cycle.ownerId === String(ownerId) && cycle.fieldId === fieldId)
      )
    );
    writeLocalCollection(
      'farm_activities',
      readLocalCollection('farm_activities').filter(
        (act) => !(act.ownerId === String(ownerId) && act.fieldId === fieldId)
      )
    );
    writeLocalCollection(
      'tasks',
      readLocalCollection('tasks').filter(
        (task) => !(task.ownerId === String(ownerId) && task.fieldId === fieldId)
      )
    );
    writeLocalCollection(
      'field_photos',
      allPhotos.filter(
        (p) => !(p.ownerId === String(ownerId) && p.fieldId === fieldId)
      )
    );
    return field;
  },

  async listCropCycles(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId: String(ownerId) };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.fieldId) query.fieldId = filters.fieldId;
      if (filters.status) query.status = filters.status;
      return CropCycle.find(query).sort({ plantingDate: -1, createdAt: -1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('crop_cycles')
      .filter((cycle) => {
        if (cycle.ownerId !== String(ownerId)) return false;
        if (filters.farmId && cycle.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && cycle.fieldId !== String(filters.fieldId)) return false;
        if (filters.status && cycle.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => new Date(b.plantingDate || 0) - new Date(a.plantingDate || 0));
  },

  async findCropCycle(ownerId, cycleId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: cycleId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      return CropCycle.findOne(query);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('crop_cycles').find((cycle) => {
      if (cycle._id !== cycleId || cycle.ownerId !== String(ownerId)) return false;
      if (options.farmId && cycle.farmId !== String(options.farmId)) return false;
      if (options.fieldId && cycle.fieldId !== String(options.fieldId)) return false;
      return true;
    }) || null;
  },

  async createCropCycle(ownerId, farmId, fieldId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne({ _id: farmId, ownerId });
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = await Field.findOne({ _id: fieldId, ownerId, farmId });
      if (!field) return { notFound: true, resource: 'field' };

      const targetStatus = values.status || 'active';
      if (targetStatus === 'active') {
        const existingActive = await CropCycle.findOne({
          ownerId,
          fieldId,
          status: 'active',
        });
        if (existingActive) {
          return { conflict: true, message: 'An active crop cycle already exists on this field.' };
        }
      }

      const cycle = await CropCycle.create({
        ...values,
        ownerId,
        farmId,
        fieldId,
      });
      return { cycle };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find((f) => f._id === String(farmId) && f.ownerId === String(ownerId));
    if (!farm) return { notFound: true, resource: 'farm' };
    const fields = readLocalCollection('fields');
    const field = fields.find(
      (f) => f._id === String(fieldId) && f.ownerId === String(ownerId) && f.farmId === String(farmId)
    );
    if (!field) return { notFound: true, resource: 'field' };

    const cycles = readLocalCollection('crop_cycles');
    const targetStatus = values.status || 'active';
    if (targetStatus === 'active') {
      const existingActive = cycles.find(
        (c) => c.ownerId === String(ownerId) && c.fieldId === String(fieldId) && c.status === 'active'
      );
      if (existingActive) {
        return { conflict: true, message: 'An active crop cycle already exists on this field.' };
      }
    }

    const now = new Date().toISOString();
    const record = await validateLocalDocument(CropCycle, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      farmId: String(farmId),
      fieldId: String(fieldId),
      createdAt: now,
      updatedAt: now,
    });
    cycles.push(record);
    writeLocalCollection('crop_cycles', cycles);
    return { cycle: record };
  },

  async updateCropCycle(ownerId, cycleId, values, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: cycleId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      const cycle = await CropCycle.findOne(query);
      if (!cycle) return null;

      if (values.status === 'active' && cycle.status !== 'active') {
        const otherActive = await CropCycle.findOne({
          _id: { $ne: cycleId },
          ownerId,
          fieldId: cycle.fieldId,
          status: 'active',
        });
        if (otherActive) {
          return { conflict: true, message: 'An active crop cycle already exists on this field.' };
        }
      }

      const updated = await CropCycle.findOneAndUpdate(
        query,
        { $set: values },
        { new: true, runValidators: true }
      );
      return { cycle: updated };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const cycles = readLocalCollection('crop_cycles');
    const index = cycles.findIndex((c) => {
      if (c._id !== cycleId || c.ownerId !== String(ownerId)) return false;
      if (options.farmId && c.farmId !== String(options.farmId)) return false;
      if (options.fieldId && c.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (index === -1) return null;
    const current = cycles[index];

    const targetStatus = values.status !== undefined ? values.status : current.status;
    if (targetStatus === 'active' && current.status !== 'active') {
      const otherActive = cycles.find(
        (c) =>
          c._id !== cycleId &&
          c.ownerId === String(ownerId) &&
          c.fieldId === String(current.fieldId) &&
          c.status === 'active'
      );
      if (otherActive) {
        return { conflict: true, message: 'An active crop cycle already exists on this field.' };
      }
    }

    const record = await validateLocalDocument(CropCycle, {
      ...current,
      ...values,
      updatedAt: new Date().toISOString(),
    });
    cycles[index] = record;
    writeLocalCollection('crop_cycles', cycles);
    return { cycle: record };
  },

  async deleteCropCycle(ownerId, cycleId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: cycleId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      const cycle = await CropCycle.findOneAndDelete(query);
      if (cycle) {
        await Promise.all([
          Task.updateMany({ ownerId, cropCycleId: cycleId }, { $unset: { cropCycleId: 1 } }),
          FarmActivity.updateMany({ ownerId, cropCycleId: cycleId }, { $unset: { cropCycleId: 1 } }),
          FieldPhoto.updateMany({ ownerId, cropCycleId: cycleId }, { $unset: { cropCycleId: 1 } }),
        ]);
      }
      return cycle;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const cycles = readLocalCollection('crop_cycles');
    const cycle = cycles.find((c) => {
      if (c._id !== cycleId || c.ownerId !== String(ownerId)) return false;
      if (options.farmId && c.farmId !== String(options.farmId)) return false;
      if (options.fieldId && c.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (!cycle) return null;
    writeLocalCollection('crop_cycles', cycles.filter((c) => c._id !== cycleId));
    writeLocalCollection(
      'tasks',
      readLocalCollection('tasks').map((t) =>
        t.cropCycleId === cycleId ? { ...t, cropCycleId: undefined } : t
      )
    );
    writeLocalCollection(
      'farm_activities',
      readLocalCollection('farm_activities').map((a) =>
        a.cropCycleId === cycleId ? { ...a, cropCycleId: undefined } : a
      )
    );
    writeLocalCollection(
      'field_photos',
      readLocalCollection('field_photos').map((p) =>
        p.cropCycleId === cycleId ? { ...p, cropCycleId: undefined } : p
      )
    );
    return cycle;
  },

  // FarmActivity methods
  async listActivities(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId: String(ownerId) };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.fieldId) query.fieldId = filters.fieldId;
      if (filters.cropCycleId) query.cropCycleId = filters.cropCycleId;
      if (filters.type) query.type = filters.type;
      if (filters.startDate || filters.endDate) {
        query.date = {};
        if (filters.startDate) query.date.$gte = new Date(filters.startDate);
        if (filters.endDate) query.date.$lte = new Date(filters.endDate);
      }
      let cursor = FarmActivity.find(query).sort({ date: -1, createdAt: -1 });
      if (filters.limit) cursor = cursor.limit(Number(filters.limit));
      return cursor;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    let list = readLocalCollection('farm_activities')
      .filter((act) => {
        if (act.ownerId !== String(ownerId)) return false;
        if (filters.farmId && act.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && act.fieldId !== String(filters.fieldId)) return false;
        if (filters.cropCycleId && act.cropCycleId !== String(filters.cropCycleId)) return false;
        if (filters.type && act.type !== filters.type) return false;
        if (filters.startDate && new Date(act.date) < new Date(filters.startDate)) return false;
        if (filters.endDate && new Date(act.date) > new Date(filters.endDate)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (filters.limit) list = list.slice(0, Number(filters.limit));
    return list;
  },

  async findActivity(ownerId, activityId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: activityId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      return FarmActivity.findOne(query);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('farm_activities').find((act) => {
      if (act._id !== activityId || act.ownerId !== String(ownerId)) return false;
      if (options.farmId && act.farmId !== String(options.farmId)) return false;
      if (options.fieldId && act.fieldId !== String(options.fieldId)) return false;
      return true;
    }) || null;
  },

  async createActivity(ownerId, farmId, fieldId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne({ _id: farmId, ownerId });
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = await Field.findOne({ _id: fieldId, ownerId, farmId });
      if (!field) return { notFound: true, resource: 'field' };

      if (values.cropCycleId) {
        const cycle = await CropCycle.findOne({
          _id: values.cropCycleId,
          ownerId,
          farmId,
          fieldId,
        });
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const activity = await FarmActivity.create({
        ...values,
        ownerId,
        farmId,
        fieldId,
      });
      return { activity };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find((f) => f._id === String(farmId) && f.ownerId === String(ownerId));
    if (!farm) return { notFound: true, resource: 'farm' };
    const fields = readLocalCollection('fields');
    const field = fields.find(
      (f) => f._id === String(fieldId) && f.ownerId === String(ownerId) && f.farmId === String(farmId)
    );
    if (!field) return { notFound: true, resource: 'field' };

    if (values.cropCycleId) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) =>
          c._id === String(values.cropCycleId) &&
          c.ownerId === String(ownerId) &&
          c.farmId === String(farmId) &&
          c.fieldId === String(fieldId)
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const now = new Date().toISOString();
    const record = await validateLocalDocument(FarmActivity, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      farmId: String(farmId),
      fieldId: String(fieldId),
      createdAt: now,
      updatedAt: now,
    });
    const activities = readLocalCollection('farm_activities');
    activities.push(record);
    writeLocalCollection('farm_activities', activities);
    return { activity: record };
  },

  async updateActivity(ownerId, activityId, values, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: activityId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      const activity = await FarmActivity.findOne(query);
      if (!activity) return null;

      if (values.cropCycleId !== undefined && values.cropCycleId !== null) {
        const cycle = await CropCycle.findOne({
          _id: values.cropCycleId,
          ownerId,
          farmId: activity.farmId,
          fieldId: activity.fieldId,
        });
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const updated = await FarmActivity.findOneAndUpdate(
        query,
        { $set: values },
        { new: true, runValidators: true }
      );
      return { activity: updated };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const activities = readLocalCollection('farm_activities');
    const index = activities.findIndex((a) => {
      if (a._id !== activityId || a.ownerId !== String(ownerId)) return false;
      if (options.farmId && a.farmId !== String(options.farmId)) return false;
      if (options.fieldId && a.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (index === -1) return null;
    const current = activities[index];

    if (values.cropCycleId !== undefined && values.cropCycleId !== null) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) =>
          c._id === String(values.cropCycleId) &&
          c.ownerId === String(ownerId) &&
          c.farmId === String(current.farmId) &&
          c.fieldId === String(current.fieldId)
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const record = await validateLocalDocument(FarmActivity, {
      ...current,
      ...values,
      updatedAt: new Date().toISOString(),
    });
    activities[index] = record;
    writeLocalCollection('farm_activities', activities);
    return { activity: record };
  },

  async deleteActivity(ownerId, activityId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: activityId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      return FarmActivity.findOneAndDelete(query);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const activities = readLocalCollection('farm_activities');
    const activity = activities.find((a) => {
      if (a._id !== activityId || a.ownerId !== String(ownerId)) return false;
      if (options.farmId && a.farmId !== String(options.farmId)) return false;
      if (options.fieldId && a.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (!activity) return null;
    writeLocalCollection('farm_activities', activities.filter((a) => a._id !== activityId));
    return activity;
  },

  // Task methods
  async listTasks(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId: String(ownerId) };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.fieldId) query.fieldId = filters.fieldId;
      if (filters.cropCycleId) query.cropCycleId = filters.cropCycleId;
      if (filters.status) query.status = filters.status;
      if (filters.type) query.type = filters.type;
      if (filters.priority) query.priority = filters.priority;
      const now = new Date();
      const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const utcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const utcEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      const start = new Date(Math.min(localStart.getTime(), utcStart.getTime()));
      const end = new Date(Math.max(localEnd.getTime(), utcEnd.getTime()));

      if (filters.due === 'overdue') {
        query.dueDate = { $lt: start };
        if (!filters.status) query.status = { $nin: ['completed', 'cancelled'] };
      } else if (filters.due === 'today') {
        query.dueDate = { $gte: start, $lte: end };
      } else if (filters.due === 'upcoming') {
        query.dueDate = { $gte: start };
      }
      let cursor = Task.find(query).sort({ dueDate: 1, createdAt: -1 });
      if (filters.limit) cursor = cursor.limit(Number(filters.limit));
      return cursor;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date();
    const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const utcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).getTime();
    const utcEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).getTime();
    const todayStart = Math.min(localStart, utcStart);
    const todayEnd = Math.max(localEnd, utcEnd);

    let list = readLocalCollection('tasks')
      .filter((task) => {
        if (task.ownerId !== String(ownerId)) return false;
        if (filters.farmId && task.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && task.fieldId !== String(filters.fieldId)) return false;
        if (filters.cropCycleId && task.cropCycleId !== String(filters.cropCycleId)) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.type && task.type !== filters.type) return false;
        if (filters.priority && task.priority !== filters.priority) return false;

        const dueTime = new Date(task.dueDate).getTime();
        if (filters.due === 'overdue') {
          if (dueTime >= todayStart) return false;
          if (!filters.status && (task.status === 'completed' || task.status === 'cancelled')) {
            return false;
          }
        } else if (filters.due === 'today') {
          if (dueTime < todayStart || dueTime > todayEnd) return false;
        } else if (filters.due === 'upcoming') {
          if (dueTime < todayStart) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
    if (filters.limit) list = list.slice(0, Number(filters.limit));
    return list;
  },

  async findTask(ownerId, taskId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: taskId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      return Task.findOne(query);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('tasks').find((t) => {
      if (t._id !== taskId || t.ownerId !== String(ownerId)) return false;
      if (options.farmId && t.farmId !== String(options.farmId)) return false;
      if (options.fieldId && t.fieldId !== String(options.fieldId)) return false;
      return true;
    }) || null;
  },

  async createTask(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      if (values.farmId) {
        const farm = await Farm.findOne({ _id: values.farmId, ownerId });
        if (!farm) return { notFound: true, resource: 'farm' };
      }
      if (values.fieldId) {
        const fieldQuery = { _id: values.fieldId, ownerId };
        if (values.farmId) fieldQuery.farmId = values.farmId;
        const field = await Field.findOne(fieldQuery);
        if (!field) return { notFound: true, resource: 'field' };
      }
      if (values.cropCycleId) {
        const cycleQuery = { _id: values.cropCycleId, ownerId };
        if (values.farmId) cycleQuery.farmId = values.farmId;
        if (values.fieldId) cycleQuery.fieldId = values.fieldId;
        const cycle = await CropCycle.findOne(cycleQuery);
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const task = await Task.create({
        ...values,
        ownerId,
        ...(values.status === 'completed' && !values.completedAt ? { completedAt: new Date() } : {}),
      });
      return { task };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    if (values.farmId) {
      const farms = readLocalCollection('farms');
      const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
      if (!farm) return { notFound: true, resource: 'farm' };
    }
    if (values.fieldId) {
      const fields = readLocalCollection('fields');
      const field = fields.find(
        (f) =>
          f._id === String(values.fieldId) &&
          f.ownerId === String(ownerId) &&
          (!values.farmId || f.farmId === String(values.farmId))
      );
      if (!field) return { notFound: true, resource: 'field' };
    }
    if (values.cropCycleId) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) =>
          c._id === String(values.cropCycleId) &&
          c.ownerId === String(ownerId) &&
          (!values.farmId || c.farmId === String(values.farmId)) &&
          (!values.fieldId || c.fieldId === String(values.fieldId))
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const now = new Date().toISOString();
    const record = await validateLocalDocument(Task, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      completedAt: values.status === 'completed' ? now : values.completedAt || undefined,
      createdAt: now,
      updatedAt: now,
    });
    const tasks = readLocalCollection('tasks');
    tasks.push(record);
    writeLocalCollection('tasks', tasks);
    return { task: record };
  },

  async updateTask(ownerId, taskId, values, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: taskId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      const task = await Task.findOne(query);
      if (!task) return null;

      const targetFarmId = values.farmId !== undefined ? values.farmId : task.farmId;
      const targetFieldId = values.fieldId !== undefined ? values.fieldId : task.fieldId;

      if (values.farmId && values.farmId !== String(task.farmId)) {
        const farm = await Farm.findOne({ _id: values.farmId, ownerId });
        if (!farm) return { notFound: true, resource: 'farm' };
      }
      if (values.fieldId && values.fieldId !== String(task.fieldId)) {
        const fieldQuery = { _id: values.fieldId, ownerId };
        if (targetFarmId) fieldQuery.farmId = targetFarmId;
        const field = await Field.findOne(fieldQuery);
        if (!field) return { notFound: true, resource: 'field' };
      }
      if (values.cropCycleId && values.cropCycleId !== String(task.cropCycleId)) {
        const cycleQuery = { _id: values.cropCycleId, ownerId };
        if (targetFarmId) cycleQuery.farmId = targetFarmId;
        if (targetFieldId) cycleQuery.fieldId = targetFieldId;
        const cycle = await CropCycle.findOne(cycleQuery);
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const updatePayload = { ...values };
      if (values.status === 'completed' && !task.completedAt && !values.completedAt) {
        updatePayload.completedAt = new Date();
      } else if (values.status && values.status !== 'completed' && task.status === 'completed') {
        updatePayload.completedAt = null;
      }

      const updated = await Task.findOneAndUpdate(
        query,
        { $set: updatePayload },
        { new: true, runValidators: true }
      );
      return { task: updated };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const tasks = readLocalCollection('tasks');
    const index = tasks.findIndex((t) => {
      if (t._id !== taskId || t.ownerId !== String(ownerId)) return false;
      if (options.farmId && t.farmId !== String(options.farmId)) return false;
      if (options.fieldId && t.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (index === -1) return null;
    const current = tasks[index];

    const targetFarmId = values.farmId !== undefined ? values.farmId : current.farmId;
    const targetFieldId = values.fieldId !== undefined ? values.fieldId : current.fieldId;

    if (values.farmId && values.farmId !== String(current.farmId)) {
      const farms = readLocalCollection('farms');
      const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
      if (!farm) return { notFound: true, resource: 'farm' };
    }
    if (values.fieldId && values.fieldId !== String(current.fieldId)) {
      const fields = readLocalCollection('fields');
      const field = fields.find(
        (f) =>
          f._id === String(values.fieldId) &&
          f.ownerId === String(ownerId) &&
          (!targetFarmId || f.farmId === String(targetFarmId))
      );
      if (!field) return { notFound: true, resource: 'field' };
    }
    if (values.cropCycleId && values.cropCycleId !== String(current.cropCycleId)) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) =>
          c._id === String(values.cropCycleId) &&
          c.ownerId === String(ownerId) &&
          (!targetFarmId || c.farmId === String(targetFarmId)) &&
          (!targetFieldId || c.fieldId === String(targetFieldId))
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const now = new Date().toISOString();
    let completedAt = current.completedAt;
    if (values.status === 'completed' && !current.completedAt && !values.completedAt) {
      completedAt = now;
    } else if (values.status && values.status !== 'completed' && current.status === 'completed') {
      completedAt = null;
    } else if (values.completedAt !== undefined) {
      completedAt = values.completedAt;
    }

    const record = await validateLocalDocument(Task, {
      ...current,
      ...values,
      completedAt,
      updatedAt: now,
    });
    tasks[index] = record;
    writeLocalCollection('tasks', tasks);
    return { task: record };
  },

  async deleteTask(ownerId, taskId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: taskId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      return Task.findOneAndDelete(query);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const tasks = readLocalCollection('tasks');
    const task = tasks.find((t) => {
      if (t._id !== taskId || t.ownerId !== String(ownerId)) return false;
      if (options.farmId && t.farmId !== String(options.farmId)) return false;
      if (options.fieldId && t.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (!task) return null;
    writeLocalCollection('tasks', tasks.filter((t) => t._id !== taskId));
    return task;
  },

  // FieldPhoto methods
  async listPhotos(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId: String(ownerId) };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.fieldId) query.fieldId = filters.fieldId;
      if (filters.cropCycleId) query.cropCycleId = filters.cropCycleId;
      return FieldPhoto.find(query).sort({ capturedAt: -1, createdAt: -1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('field_photos')
      .filter((photo) => {
        if (photo.ownerId !== String(ownerId)) return false;
        if (filters.farmId && photo.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && photo.fieldId !== String(filters.fieldId)) return false;
        if (filters.cropCycleId && photo.cropCycleId !== String(filters.cropCycleId)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.capturedAt || b.createdAt).getTime() -
          new Date(a.capturedAt || a.createdAt).getTime()
      );
  },

  async findPhoto(ownerId, photoId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: photoId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      return FieldPhoto.findOne(query);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return (
      readLocalCollection('field_photos').find((photo) => {
        if (photo._id !== photoId || photo.ownerId !== String(ownerId)) return false;
        if (options.farmId && photo.farmId !== String(options.farmId)) return false;
        if (options.fieldId && photo.fieldId !== String(options.fieldId)) return false;
        return true;
      }) || null
    );
  },

  async createPhoto(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne({ _id: values.farmId, ownerId });
      if (!farm) return { notFound: true, resource: 'farm' };

      const field = await Field.findOne({ _id: values.fieldId, farmId: values.farmId, ownerId });
      if (!field) return { notFound: true, resource: 'field' };

      if (values.cropCycleId) {
        const cycle = await CropCycle.findOne({
          _id: values.cropCycleId,
          farmId: values.farmId,
          fieldId: values.fieldId,
          ownerId,
        });
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const photo = await FieldPhoto.create({
        ...values,
        ownerId,
        capturedAt: values.capturedAt ? new Date(values.capturedAt) : new Date(),
      });
      return { photo };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
    if (!farm) return { notFound: true, resource: 'farm' };

    const fields = readLocalCollection('fields');
    const field = fields.find(
      (f) =>
        f._id === String(values.fieldId) &&
        f.farmId === String(values.farmId) &&
        f.ownerId === String(ownerId)
    );
    if (!field) return { notFound: true, resource: 'field' };

    if (values.cropCycleId) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) =>
          c._id === String(values.cropCycleId) &&
          c.farmId === String(values.farmId) &&
          c.fieldId === String(values.fieldId) &&
          c.ownerId === String(ownerId)
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const now = new Date().toISOString();
    const record = await validateLocalDocument(FieldPhoto, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      farmId: String(values.farmId),
      fieldId: String(values.fieldId),
      cropCycleId: values.cropCycleId ? String(values.cropCycleId) : undefined,
      capturedAt: values.capturedAt ? new Date(values.capturedAt).toISOString() : now,
      createdAt: now,
      updatedAt: now,
    });
    const photos = readLocalCollection('field_photos');
    photos.push(record);
    writeLocalCollection('field_photos', photos);
    return { photo: record };
  },

  async updatePhoto(ownerId, photoId, values, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: photoId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      const photo = await FieldPhoto.findOne(query);
      if (!photo) return null;

      if (values.cropCycleId && values.cropCycleId !== String(photo.cropCycleId)) {
        const cycle = await CropCycle.findOne({
          _id: values.cropCycleId,
          farmId: photo.farmId,
          fieldId: photo.fieldId,
          ownerId,
        });
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const updatePayload = {};
      if (values.notes !== undefined) updatePayload.notes = values.notes;
      if (values.capturedAt !== undefined) updatePayload.capturedAt = new Date(values.capturedAt);
      if (values.cropCycleId !== undefined) {
        updatePayload.cropCycleId = values.cropCycleId || null;
      }

      const updated = await FieldPhoto.findOneAndUpdate(
        query,
        { $set: updatePayload },
        { new: true, runValidators: true }
      );
      return { photo: updated };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const photos = readLocalCollection('field_photos');
    const index = photos.findIndex((p) => {
      if (p._id !== photoId || p.ownerId !== String(ownerId)) return false;
      if (options.farmId && p.farmId !== String(options.farmId)) return false;
      if (options.fieldId && p.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (index === -1) return null;
    const current = photos[index];

    if (values.cropCycleId && values.cropCycleId !== String(current.cropCycleId)) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) =>
          c._id === String(values.cropCycleId) &&
          c.farmId === String(current.farmId) &&
          c.fieldId === String(current.fieldId) &&
          c.ownerId === String(ownerId)
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const now = new Date().toISOString();
    const updatedValues = { ...current };
    if (values.notes !== undefined) updatedValues.notes = values.notes;
    if (values.capturedAt !== undefined) {
      updatedValues.capturedAt = new Date(values.capturedAt).toISOString();
    }
    if (values.cropCycleId !== undefined) {
      updatedValues.cropCycleId = values.cropCycleId || undefined;
    }
    updatedValues.updatedAt = now;

    const record = await validateLocalDocument(FieldPhoto, updatedValues);
    photos[index] = record;
    writeLocalCollection('field_photos', photos);
    return { photo: record };
  },

  async deletePhoto(ownerId, photoId, options = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { _id: photoId, ownerId: String(ownerId) };
      if (options.farmId) query.farmId = options.farmId;
      if (options.fieldId) query.fieldId = options.fieldId;
      const photo = await FieldPhoto.findOneAndDelete(query);
      if (photo) {
        await photoStorage.deletePhoto({
          storageKey: photo.storageKey,
          storageProvider: photo.storageProvider,
        }).catch(() => {});
      }
      return photo;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const photos = readLocalCollection('field_photos');
    const photo = photos.find((p) => {
      if (p._id !== photoId || p.ownerId !== String(ownerId)) return false;
      if (options.farmId && p.farmId !== String(options.farmId)) return false;
      if (options.fieldId && p.fieldId !== String(options.fieldId)) return false;
      return true;
    });
    if (!photo) return null;
    await photoStorage.deletePhoto({
      storageKey: photo.storageKey,
      storageProvider: photo.storageProvider,
    }).catch(() => {});
    writeLocalCollection('field_photos', photos.filter((p) => p._id !== photoId));
    return photo;
  },

  // ==================== FINANCES ====================
  async listFinanceRecords(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.fieldId) query.fieldId = filters.fieldId;
      if (filters.cropCycleId) query.cropCycleId = filters.cropCycleId;
      if (filters.type) query.type = filters.type;
      if (filters.category) query.category = filters.category;
      if (filters.startDate || filters.endDate) {
        query.date = {};
        if (filters.startDate) query.date.$gte = new Date(filters.startDate);
        if (filters.endDate) query.date.$lte = new Date(filters.endDate);
      }
      return FinanceRecord.find(query).sort({ date: -1, createdAt: -1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('finance_records')
      .filter((rec) => {
        if (rec.ownerId !== String(ownerId)) return false;
        if (filters.farmId && rec.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && rec.fieldId !== String(filters.fieldId)) return false;
        if (filters.cropCycleId && rec.cropCycleId !== String(filters.cropCycleId)) return false;
        if (filters.type && rec.type !== filters.type) return false;
        if (filters.category && rec.category !== filters.category) return false;
        if (filters.startDate && new Date(rec.date) < new Date(filters.startDate)) return false;
        if (filters.endDate && new Date(rec.date) > new Date(filters.endDate)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  async createFinanceRecord(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne({ _id: values.farmId, ownerId });
      if (!farm) return { notFound: true, resource: 'farm' };

      if (values.fieldId) {
        const field = await Field.findOne({ _id: values.fieldId, ownerId, farmId: values.farmId });
        if (!field) return { notFound: true, resource: 'field' };
      }
      if (values.cropCycleId) {
        const cycle = await CropCycle.findOne({ _id: values.cropCycleId, ownerId, farmId: values.farmId });
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      const record = await FinanceRecord.create({ ...values, ownerId });
      return { record };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
    if (!farm) return { notFound: true, resource: 'farm' };

    if (values.fieldId) {
      const fields = readLocalCollection('fields');
      const field = fields.find(
        (f) => f._id === String(values.fieldId) && f.ownerId === String(ownerId) && f.farmId === String(values.farmId)
      );
      if (!field) return { notFound: true, resource: 'field' };
    }
    if (values.cropCycleId) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) => c._id === String(values.cropCycleId) && c.ownerId === String(ownerId) && c.farmId === String(values.farmId)
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const now = new Date().toISOString();
    const validated = await validateLocalDocument(FinanceRecord, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      date: values.date ? new Date(values.date).toISOString() : now,
      createdAt: now,
      updatedAt: now,
    });
    const records = readLocalCollection('finance_records');
    records.push(validated);
    writeLocalCollection('finance_records', records);
    return { record: validated };
  },

  async updateFinanceRecord(ownerId, id, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const record = await FinanceRecord.findOne({ _id: id, ownerId });
      if (!record) return null;

      if (values.farmId && String(values.farmId) !== String(record.farmId)) {
        const farm = await Farm.findOne({ _id: values.farmId, ownerId });
        if (!farm) return { notFound: true, resource: 'farm' };
      }
      if (values.fieldId && values.fieldId !== String(record.fieldId)) {
        const field = await Field.findOne({ _id: values.fieldId, ownerId, farmId: values.farmId || record.farmId });
        if (!field) return { notFound: true, resource: 'field' };
      }
      if (values.cropCycleId && values.cropCycleId !== String(record.cropCycleId)) {
        const cycle = await CropCycle.findOne({ _id: values.cropCycleId, ownerId, farmId: values.farmId || record.farmId });
        if (!cycle) return { notFound: true, resource: 'cropCycle' };
      }

      if (values.type !== undefined) record.type = values.type;
      if (values.category !== undefined) record.category = values.category;
      if (values.amount !== undefined) record.amount = Number(values.amount);
      if (values.date !== undefined) record.date = values.date;
      if (values.description !== undefined) record.description = values.description;
      if (values.receiptNumber !== undefined) record.receiptNumber = values.receiptNumber;
      if (values.farmId !== undefined) record.farmId = values.farmId;
      if (values.fieldId !== undefined) record.fieldId = values.fieldId || undefined;
      if (values.cropCycleId !== undefined) record.cropCycleId = values.cropCycleId || undefined;

      await record.save();
      return { record };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const records = readLocalCollection('finance_records');
    const index = records.findIndex((r) => r._id === String(id) && r.ownerId === String(ownerId));
    if (index === -1) return null;

    const existing = records[index];
    if (values.farmId && String(values.farmId) !== String(existing.farmId)) {
      const farms = readLocalCollection('farms');
      const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
      if (!farm) return { notFound: true, resource: 'farm' };
    }
    if (values.fieldId && values.fieldId !== String(existing.fieldId)) {
      const fields = readLocalCollection('fields');
      const field = fields.find(
        (f) => f._id === String(values.fieldId) && f.ownerId === String(ownerId) && f.farmId === String(values.farmId || existing.farmId)
      );
      if (!field) return { notFound: true, resource: 'field' };
    }
    if (values.cropCycleId && values.cropCycleId !== String(existing.cropCycleId)) {
      const cycles = readLocalCollection('crop_cycles');
      const cycle = cycles.find(
        (c) => c._id === String(values.cropCycleId) && c.ownerId === String(ownerId) && c.farmId === String(values.farmId || existing.farmId)
      );
      if (!cycle) return { notFound: true, resource: 'cropCycle' };
    }

    const updated = {
      ...existing,
      ...values,
      amount: values.amount !== undefined ? Number(values.amount) : existing.amount,
      updatedAt: new Date().toISOString(),
    };
    records[index] = updated;
    writeLocalCollection('finance_records', records);
    return { record: updated };
  },

  async deleteFinanceRecord(ownerId, id) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return FinanceRecord.findOneAndDelete({ _id: id, ownerId });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const records = readLocalCollection('finance_records');
    const index = records.findIndex((r) => r._id === id && r.ownerId === String(ownerId));
    if (index === -1) return null;
    const [deleted] = records.splice(index, 1);
    writeLocalCollection('finance_records', records);
    return deleted;
  },

  async getFinanceSummary(ownerId, filters = {}) {
    const records = await this.listFinanceRecords(ownerId, filters);
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown = {};

    for (const rec of records) {
      const amt = Number(rec.amount) || 0;
      if (rec.type === 'revenue') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
      categoryBreakdown[rec.category] = (categoryBreakdown[rec.category] || 0) + amt;
    }

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
      recordCount: records.length,
      categoryBreakdown,
    };
  },

  // ==================== INVENTORY ====================
  async listInventoryItems(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.category) query.category = filters.category;
      return InventoryItem.find(query).sort({ name: 1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('inventory_items')
      .filter((item) => {
        if (item.ownerId !== String(ownerId)) return false;
        if (filters.farmId && item.farmId !== String(filters.farmId)) return false;
        if (filters.category && item.category !== filters.category) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findInventoryItem(ownerId, itemId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return InventoryItem.findOne({ _id: itemId, ownerId });
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('inventory_items').find(
      (item) => item._id === itemId && item.ownerId === String(ownerId)
    ) || null;
  },

  async createInventoryItem(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne({ _id: values.farmId, ownerId });
      if (!farm) return { notFound: true, resource: 'farm' };

      const item = await InventoryItem.create({ ...values, ownerId });
      return { item };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
    if (!farm) return { notFound: true, resource: 'farm' };

    const now = new Date().toISOString();
    const validated = await validateLocalDocument(InventoryItem, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      createdAt: now,
      updatedAt: now,
    });
    const items = readLocalCollection('inventory_items');
    items.push(validated);
    writeLocalCollection('inventory_items', items);
    return { item: validated };
  },

  async updateInventoryItem(ownerId, itemId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return InventoryItem.findOneAndUpdate(
        { _id: itemId, ownerId },
        { $set: values },
        { new: true, runValidators: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const items = readLocalCollection('inventory_items');
    const index = items.findIndex((i) => i._id === itemId && i.ownerId === String(ownerId));
    if (index === -1) return null;

    const updated = await validateLocalDocument(InventoryItem, {
      ...items[index],
      ...values,
      updatedAt: new Date().toISOString(),
    });
    items[index] = updated;
    writeLocalCollection('inventory_items', items);
    return updated;
  },

  async deleteInventoryItem(ownerId, itemId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const item = await InventoryItem.findOneAndDelete({ _id: itemId, ownerId });
      if (item) {
        await InventoryMovement.deleteMany({ itemId, ownerId });
      }
      return item;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const items = readLocalCollection('inventory_items');
    const index = items.findIndex((i) => i._id === itemId && i.ownerId === String(ownerId));
    if (index === -1) return null;
    const [deleted] = items.splice(index, 1);
    writeLocalCollection('inventory_items', items);

    const movements = readLocalCollection('inventory_movements').filter((m) => m.itemId !== itemId);
    writeLocalCollection('inventory_movements', movements);
    return deleted;
  },

  async logInventoryMovement(ownerId, values) {
    const item = await this.findInventoryItem(ownerId, values.itemId);
    if (!item) return { notFound: true, resource: 'inventoryItem' };

    const moveQty = Number(values.quantity);
    if (isNaN(moveQty) || moveQty <= 0) {
      const err = new Error('Movement quantity must be positive.');
      err.status = 400;
      throw err;
    }

    if (values.type === 'out' && (item.quantity - moveQty) < 0) {
      const err = new Error(`Insufficient stock. Available: ${item.quantity} ${item.unit}`);
      err.status = 400;
      throw err;
    }

    const newQuantity = values.type === 'in' ? item.quantity + moveQty : item.quantity - moveQty;
    const updatedItem = await this.updateInventoryItem(ownerId, values.itemId, { quantity: newQuantity });

    const mode = getStorageMode();
    let movement;
    if (mode === 'mongodb') {
      movement = await InventoryMovement.create({
        ...values,
        ownerId,
        farmId: item.farmId,
      });
    } else if (mode === 'local-json-development') {
      const now = new Date().toISOString();
      movement = await validateLocalDocument(InventoryMovement, {
        ...values,
        _id: newLocalId(),
        ownerId: String(ownerId),
        farmId: String(item.farmId),
        date: values.date ? new Date(values.date).toISOString() : now,
        createdAt: now,
        updatedAt: now,
      });
      const movements = readLocalCollection('inventory_movements');
      movements.push(movement);
      writeLocalCollection('inventory_movements', movements);
    } else {
      throw unavailableError();
    }

    // Check low stock alert
    if (newQuantity <= (item.minThreshold || 0)) {
      await this.createNotification(ownerId, {
        title: `Low Stock Alert: ${item.name}`,
        message: `Current stock of ${item.name} is ${newQuantity} ${item.unit}, which is at or below the minimum threshold (${item.minThreshold} ${item.unit}).`,
        type: 'inventory_low',
        link: '/inventory',
      }).catch(() => {});
    }

    return { movement, item: updatedItem };
  },

  async listInventoryMovements(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId };
      if (filters.itemId) query.itemId = filters.itemId;
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.type) query.type = filters.type;
      return InventoryMovement.find(query).sort({ date: -1, createdAt: -1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('inventory_movements')
      .filter((m) => {
        if (m.ownerId !== String(ownerId)) return false;
        if (filters.itemId && m.itemId !== String(filters.itemId)) return false;
        if (filters.farmId && m.farmId !== String(filters.farmId)) return false;
        if (filters.type && m.type !== filters.type) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  // ==================== SENSORS & TELEMETRY ====================
  async listSensors(ownerId, filters = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = { ownerId };
      if (filters.farmId) query.farmId = filters.farmId;
      if (filters.fieldId) query.fieldId = filters.fieldId;
      if (filters.type) query.type = filters.type;
      return Sensor.find(query).sort({ createdAt: -1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('sensors')
      .filter((s) => {
        if (s.ownerId !== String(ownerId)) return false;
        if (filters.farmId && s.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && s.fieldId !== String(filters.fieldId)) return false;
        if (filters.type && s.type !== filters.type) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  },

  async findSensor(ownerId, sensorId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Sensor.findOne({ _id: sensorId, ownerId });
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('sensors').find(
      (s) => s._id === sensorId && s.ownerId === String(ownerId)
    ) || null;
  },

  async findSensorByUid(ownerId, deviceUid) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return Sensor.findOne({ deviceUid, ...(ownerId ? { ownerId } : {}) });
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('sensors').find(
      (s) => s.deviceUid === deviceUid && (!ownerId || s.ownerId === String(ownerId))
    ) || null;
  },

  async createSensor(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findOne({ _id: values.farmId, ownerId });
      if (!farm) return { notFound: true, resource: 'farm' };

      if (values.fieldId) {
        const field = await Field.findOne({ _id: values.fieldId, ownerId, farmId: values.farmId });
        if (!field) return { notFound: true, resource: 'field' };
      }

      const existing = await Sensor.findOne({ deviceUid: values.deviceUid, ownerId });
      if (existing) return { conflict: true, message: 'Sensor with this Device UID already exists.' };

      const sensor = await Sensor.create({ ...values, ownerId });
      return { sensor };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const farms = readLocalCollection('farms');
    const farm = farms.find((f) => f._id === String(values.farmId) && f.ownerId === String(ownerId));
    if (!farm) return { notFound: true, resource: 'farm' };

    if (values.fieldId) {
      const fields = readLocalCollection('fields');
      const field = fields.find(
        (f) => f._id === String(values.fieldId) && f.ownerId === String(ownerId) && f.farmId === String(values.farmId)
      );
      if (!field) return { notFound: true, resource: 'field' };
    }

    const sensors = readLocalCollection('sensors');
    if (sensors.some((s) => s.deviceUid === values.deviceUid && s.ownerId === String(ownerId))) {
      return { conflict: true, message: 'Sensor with this Device UID already exists.' };
    }

    const now = new Date().toISOString();
    const validated = await validateLocalDocument(Sensor, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      createdAt: now,
      updatedAt: now,
    });
    sensors.push(validated);
    writeLocalCollection('sensors', sensors);
    return { sensor: validated };
  },

  async updateSensor(ownerId, sensorId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Sensor.findOneAndUpdate(
        { _id: sensorId, ownerId },
        { $set: values },
        { new: true, runValidators: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const sensors = readLocalCollection('sensors');
    const index = sensors.findIndex((s) => s._id === sensorId && s.ownerId === String(ownerId));
    if (index === -1) return null;

    const updated = await validateLocalDocument(Sensor, {
      ...sensors[index],
      ...values,
      updatedAt: new Date().toISOString(),
    });
    sensors[index] = updated;
    writeLocalCollection('sensors', sensors);
    return updated;
  },

  async deleteSensor(ownerId, sensorId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const sensor = await Sensor.findOneAndDelete({ _id: sensorId, ownerId });
      if (sensor) {
        await SensorReading.deleteMany({ sensorId, ownerId });
      }
      return sensor;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const sensors = readLocalCollection('sensors');
    const index = sensors.findIndex((s) => s._id === sensorId && s.ownerId === String(ownerId));
    if (index === -1) return null;
    const [deleted] = sensors.splice(index, 1);
    writeLocalCollection('sensors', sensors);

    const readings = readLocalCollection('sensor_readings').filter((r) => r.sensorId !== sensorId);
    writeLocalCollection('sensor_readings', readings);
    return deleted;
  },

  async addSensorReading(sensor, readingData) {
    const mode = getStorageMode();
    const timestamp = readingData.timestamp ? new Date(readingData.timestamp) : new Date();
    const val = Number(readingData.value);
    const isSimulated = Boolean(readingData.isSimulated || sensor.isSimulated);
    const source = readingData.source || (isSimulated ? 'simulated' : 'physical');

    let reading;
    if (mode === 'mongodb') {
      reading = await SensorReading.create({
        ownerId: sensor.ownerId,
        sensorId: sensor._id,
        farmId: sensor.farmId,
        fieldId: sensor.fieldId,
        value: val,
        unit: readingData.unit || (sensor.thresholds && sensor.thresholds.unit) || '%',
        timestamp,
        isSimulated,
        source,
      });
      await Sensor.findByIdAndUpdate(sensor._id, {
        $set: {
          lastReadingAt: timestamp,
          status: 'active',
          ...(readingData.batteryLevel !== undefined ? { batteryLevel: readingData.batteryLevel } : {}),
        },
      });
    } else if (mode === 'local-json-development') {
      const now = new Date().toISOString();
      reading = await validateLocalDocument(SensorReading, {
        _id: newLocalId(),
        ownerId: String(sensor.ownerId),
        sensorId: String(sensor._id),
        farmId: String(sensor.farmId),
        fieldId: sensor.fieldId ? String(sensor.fieldId) : undefined,
        value: val,
        unit: readingData.unit || (sensor.thresholds && sensor.thresholds.unit) || '%',
        timestamp: timestamp.toISOString(),
        isSimulated,
        source,
        createdAt: now,
        updatedAt: now,
      });
      const readings = readLocalCollection('sensor_readings');
      readings.push(reading);
      writeLocalCollection('sensor_readings', readings);

      const sensors = readLocalCollection('sensors');
      const idx = sensors.findIndex((s) => s._id === String(sensor._id));
      if (idx !== -1) {
        sensors[idx].lastReadingAt = timestamp.toISOString();
        sensors[idx].status = 'active';
        if (readingData.batteryLevel !== undefined) {
          sensors[idx].batteryLevel = readingData.batteryLevel;
        }
        writeLocalCollection('sensors', sensors);
      }
    } else {
      throw unavailableError();
    }

    // Check thresholds and generate alert if breached with duplicate prevention
    if (sensor.thresholds) {
      const { min, max, unit } = sensor.thresholds;
      const isLow = min !== undefined && val < min;
      const isHigh = max !== undefined && val > max;

      if (isLow || isHigh) {
        const thresholdLimit = isLow ? min : max;
        const breachType = isLow ? 'low' : 'high';
        const alertKey = `sensor:${sensor._id}:${breachType}`;

        // Severity: if deviation >= 25% -> critical, else warning
        const diffRatio = thresholdLimit !== 0 ? Math.abs(val - thresholdLimit) / Math.abs(thresholdLimit) : 0.5;
        const severity = diffRatio >= 0.25 ? 'critical' : 'warning';

        const prefix = isSimulated ? '[SIMULATED] ' : '';
        const title = isLow
          ? `${prefix}Sensor Alert: Low Reading on ${sensor.name}`
          : `${prefix}Sensor Alert: High Reading on ${sensor.name}`;
        const message = isLow
          ? `${sensor.name} measured ${val} ${unit || ''}, below the minimum threshold of ${min} ${unit || ''}.`
          : `${sensor.name} measured ${val} ${unit || ''}, above the maximum threshold of ${max} ${unit || ''}.`;

        // Check if an unacknowledged alert with this alertKey exists within 30 minutes
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        let recentDuplicate = false;

        if (mode === 'mongodb') {
          const existing = await Notification.findOne({
            ownerId: sensor.ownerId,
            alertKey,
            acknowledged: false,
            createdAt: { $gte: thirtyMinsAgo },
          });
          if (existing) recentDuplicate = true;
        } else if (mode === 'local-json-development') {
          const notifs = readLocalCollection('notifications');
          const existing = notifs.find(
            (n) =>
              n.ownerId === String(sensor.ownerId) &&
              n.alertKey === alertKey &&
              !n.acknowledged &&
              new Date(n.createdAt) >= thirtyMinsAgo
          );
          if (existing) recentDuplicate = true;
        }

        if (!recentDuplicate) {
          await this.createNotification(sensor.ownerId, {
            title,
            message,
            type: 'weather_alert',
            severity,
            alertKey,
            acknowledged: false,
            sensorId: sensor._id,
            farmId: sensor.farmId,
            fieldId: sensor.fieldId,
            isSimulated,
            link: '/monitoring',
          }).catch(() => {});
        }
      }
    }

    return reading;
  },

  async listSensorReadings(ownerId, sensorId, limit = 100) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return SensorReading.find({ sensorId, ownerId })
        .sort({ timestamp: -1 })
        .limit(Number(limit));
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('sensor_readings')
      .filter((r) => r.sensorId === String(sensorId) && r.ownerId === String(ownerId))
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, Number(limit));
  },

  async listSensorReadingsForCharts(ownerId, filters = {}) {
    const mode = getStorageMode();
    const query = { ownerId };
    if (filters.farmId) query.farmId = filters.farmId;
    if (filters.fieldId) query.fieldId = filters.fieldId;
    if (filters.sensorId) query.sensorId = filters.sensorId;

    let since = null;
    if (filters.range === '24h') {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (filters.range === '7d') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (filters.range === '30d') {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (filters.from) {
      since = new Date(filters.from);
    }

    if (since) {
      query.timestamp = { $gte: since };
      if (filters.to) {
        query.timestamp.$lte = new Date(filters.to);
      }
    }

    if (mode === 'mongodb') {
      return SensorReading.find(query).sort({ timestamp: 1 }).limit(1000);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('sensor_readings')
      .filter((r) => {
        if (r.ownerId !== String(ownerId)) return false;
        if (filters.farmId && r.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && r.fieldId !== String(filters.fieldId)) return false;
        if (filters.sensorId && r.sensorId !== String(filters.sensorId)) return false;
        if (since && new Date(r.timestamp) < since) return false;
        if (filters.to && new Date(r.timestamp) > new Date(filters.to)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
      .slice(-1000);
  },

  // ==================== WEATHER SNAPSHOTS ====================
  async saveWeatherSnapshot(ownerId, farmId, data) {
    const mode = getStorageMode();
    const snapshotData = {
      ownerId,
      farmId,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      temperature: data.temperature,
      apparentTemperature: data.apparentTemperature,
      humidity: data.humidity,
      precipitation: data.precipitation || 0,
      rain: data.rain || 0,
      windSpeed: data.windSpeed,
      windDirection: data.windDirection,
      weatherCode: data.weatherCode,
      condition: data.condition,
      source: data.source || 'Open-Meteo Meteorological Model',
      isSimulated: Boolean(data.isSimulated),
      coordinates: data.coordinates,
    };

    if (mode === 'mongodb') {
      return WeatherSnapshot.create(snapshotData);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date().toISOString();
    const validated = await validateLocalDocument(WeatherSnapshot, {
      ...snapshotData,
      _id: newLocalId(),
      createdAt: now,
      updatedAt: now,
    });
    const snapshots = readLocalCollection('weather_snapshots');
    snapshots.push(validated);
    writeLocalCollection('weather_snapshots', snapshots);
    return validated;
  },

  async getLatestWeatherSnapshot(ownerId, farmId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return WeatherSnapshot.findOne({ ownerId, farmId }).sort({ timestamp: -1 });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const snapshots = readLocalCollection('weather_snapshots')
      .filter((w) => w.ownerId === String(ownerId) && w.farmId === String(farmId))
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return snapshots[0] || null;
  },

  async listWeatherSnapshots(ownerId, farmId, filters = {}) {
    const mode = getStorageMode();
    const query = { ownerId, farmId };

    let since = null;
    if (filters.range === '24h') {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (filters.range === '7d') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (filters.range === '30d') {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (filters.from) {
      since = new Date(filters.from);
    }

    if (since) {
      query.timestamp = { $gte: since };
      if (filters.to) {
        query.timestamp.$lte = new Date(filters.to);
      }
    }

    const limit = Number(filters.limit) || 500;

    if (mode === 'mongodb') {
      return WeatherSnapshot.find(query).sort({ timestamp: 1 }).limit(limit);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('weather_snapshots')
      .filter((w) => {
        if (w.ownerId !== String(ownerId) || w.farmId !== String(farmId)) return false;
        if (since && new Date(w.timestamp) < since) return false;
        if (filters.to && new Date(w.timestamp) > new Date(filters.to)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
      .slice(-limit);
  },

  async acknowledgeAlert(ownerId, alertId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Notification.findOneAndUpdate(
        { _id: alertId, ownerId },
        { $set: { acknowledged: true, acknowledgedAt: new Date(), read: true } },
        { new: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const notifs = readLocalCollection('notifications');
    const alert = notifs.find((n) => n._id === String(alertId) && n.ownerId === String(ownerId));
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      alert.read = true;
      writeLocalCollection('notifications', notifs);
    }
    return alert || null;
  },

  async listAlerts(ownerId, filters = {}) {
    const mode = getStorageMode();
    const query = { ownerId, type: 'weather_alert' };
    if (filters.farmId) query.farmId = filters.farmId;
    if (filters.acknowledged !== undefined) {
      query.acknowledged = filters.acknowledged === 'true' || filters.acknowledged === true;
    }

    if (mode === 'mongodb') {
      return Notification.find(query).sort({ createdAt: -1 }).limit(Number(filters.limit) || 100);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('notifications')
      .filter((n) => {
        if (n.ownerId !== String(ownerId) || n.type !== 'weather_alert') return false;
        if (filters.farmId && n.farmId !== String(filters.farmId)) return false;
        if (filters.acknowledged !== undefined) {
          const isAck = filters.acknowledged === 'true' || filters.acknowledged === true;
          if (Boolean(n.acknowledged) !== isAck) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Number(filters.limit) || 100);
  },


  // ==================== NOTIFICATIONS ====================
  async listNotifications(ownerId, limit = 50) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Notification.find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(Number(limit));
    }
    if (mode !== 'local-json-development') throw unavailableError();

    return readLocalCollection('notifications')
      .filter((n) => n.ownerId === String(ownerId))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Number(limit));
  },

  async createNotification(ownerId, values) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Notification.create({ ...values, ownerId });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date().toISOString();
    const validated = await validateLocalDocument(Notification, {
      ...values,
      _id: newLocalId(),
      ownerId: String(ownerId),
      read: false,
      createdAt: now,
      updatedAt: now,
    });
    const notifications = readLocalCollection('notifications');
    notifications.push(validated);
    writeLocalCollection('notifications', notifications);
    return validated;
  },

  async markNotificationRead(ownerId, notificationId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return Notification.findOneAndUpdate(
        { _id: notificationId, ownerId },
        { $set: { read: true } },
        { new: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const notifications = readLocalCollection('notifications');
    const notif = notifications.find((n) => n._id === notificationId && n.ownerId === String(ownerId));
    if (notif) {
      notif.read = true;
      writeLocalCollection('notifications', notifications);
    }
    return notif || null;
  },

  async markAllNotificationsRead(ownerId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      await Notification.updateMany({ ownerId, read: false }, { $set: { read: true } });
      return { success: true };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const notifications = readLocalCollection('notifications');
    notifications.forEach((n) => {
      if (n.ownerId === String(ownerId)) n.read = true;
    });
    writeLocalCollection('notifications', notifications);
    return { success: true };
  },

  // Alias for listCropCycles for compatibility
  async listAllCropCycles(ownerId, filters = {}) {
    return this.listCropCycles(ownerId, filters);
  },

  // ==================== COMPREHENSIVE ANALYTICS ====================
  async getAnalyticsSummary(ownerId, filters = {}) {
    const farms = await this.listFarms(ownerId);
    const { farmId, fieldId, crop, startDate, endDate } = filters;

    const farmList = farmId ? farms.filter((f) => String(f._id || f.id) === String(farmId)) : farms;

    let fields = [];
    for (const f of farmList) {
      const flds = await this.listFields(ownerId, f._id || f.id);
      fields = fields.concat(flds);
    }
    if (fieldId) {
      fields = fields.filter((fld) => String(fld._id || fld.id) === String(fieldId));
    }

    const fieldMap = new Map();
    for (const f of fields) {
      fieldMap.set(String(f._id || f.id), f);
    }

    // Crop Cycles with filters
    const cycleFilters = {};
    if (farmId) cycleFilters.farmId = farmId;
    if (fieldId) cycleFilters.fieldId = fieldId;
    const allCycles = await this.listCropCycles(ownerId, cycleFilters);

    // Filter crop cycles if crop name filter is specified
    const filteredCycles = crop
      ? allCycles.filter((c) => String(c.cropName || '').toLowerCase() === String(crop).toLowerCase())
      : allCycles;

    const activeCycles = filteredCycles.filter((c) => c.status === 'active');
    const completedCycles = filteredCycles.filter((c) => c.status === 'completed');

    const stageDistribution = {};
    for (const cycle of activeCycles) {
      stageDistribution[cycle.stage] = (stageDistribution[cycle.stage] || 0) + 1;
    }

    // Helper for normalizing crop yields to standard kilograms (kg)
    const normalizeToKg = (quantity, unit) => {
      const qty = Number(quantity) || 0;
      if (!unit) return qty;
      const u = String(unit).toLowerCase().trim();
      if (u === 'quintal' || u === 'quintals' || u === 'qtl') return Math.round(qty * 100 * 100) / 100;
      if (u === 'tonne' || u === 'tonnes' || u === 'ton' || u === 'tons' || u === 't' || u === 'mt') return Math.round(qty * 1000 * 100) / 100;
      if (u === 'g' || u === 'grams' || u === 'gram') return Math.round((qty / 1000) * 100) / 100;
      return Math.round(qty * 100) / 100; // default kg
    };

    // Crop Production Aggregates (Normalized kg)
    const cropYields = {};
    const cropProductionMap = new Map();
    let totalHarvestedKg = 0;

    for (const cycle of completedCycles) {
      if (cycle.yieldQuantity && Number(cycle.yieldQuantity) > 0) {
        const cropName = cycle.cropName || 'Other Crop';
        const kg = normalizeToKg(cycle.yieldQuantity, cycle.yieldUnit);
        totalHarvestedKg = Math.round((totalHarvestedKg + kg) * 100) / 100;

        // Legacy format compatibility
        if (!cropYields[cropName]) {
          cropYields[cropName] = { totalQuantity: 0, unit: cycle.yieldUnit || 'kg', harvestCount: 0 };
        }
        cropYields[cropName].totalQuantity += Number(cycle.yieldQuantity);
        cropYields[cropName].harvestCount += 1;

        // Normalized production map
        if (!cropProductionMap.has(cropName)) {
          cropProductionMap.set(cropName, {
            cropName,
            totalKg: 0,
            originalQuantity: 0,
            originalUnit: cycle.yieldUnit || 'kg',
            harvestCount: 0,
          });
        }
        const entry = cropProductionMap.get(cropName);
        entry.totalKg = Math.round((entry.totalKg + kg) * 100) / 100;
        entry.originalQuantity += Number(cycle.yieldQuantity);
        entry.harvestCount += 1;
      }
    }
    const cropProduction = Array.from(cropProductionMap.values()).sort((a, b) => b.totalKg - a.totalKg);

    // Field Productivity (kg / hectare)
    const fieldProductivityMap = new Map();
    let totalHarvestedKgWithArea = 0;
    let totalAreaWithHarvest = 0;

    for (const cycle of completedCycles) {
      if (cycle.yieldQuantity && Number(cycle.yieldQuantity) > 0) {
        const fld = cycle.fieldId ? fieldMap.get(String(cycle.fieldId)) : null;
        const area = fld ? Number(fld.areaHectares) || 0 : 0;
        const kg = normalizeToKg(cycle.yieldQuantity, cycle.yieldUnit);
        const fldKey = cycle.fieldId ? String(cycle.fieldId) : (cycle.cropName || 'Field');
        const fldName = fld ? fld.name : (cycle.cropName ? `${cycle.cropName} Field` : 'Field');

        if (!fieldProductivityMap.has(fldKey)) {
          fieldProductivityMap.set(fldKey, {
            fieldId: cycle.fieldId || null,
            fieldName: fldName,
            cropName: cycle.cropName || 'Crop',
            areaHectares: area,
            totalKg: 0,
            yieldPerHectare: 0,
            hasValidArea: area > 0,
          });
        }
        const pEntry = fieldProductivityMap.get(fldKey);
        pEntry.totalKg = Math.round((pEntry.totalKg + kg) * 100) / 100;
        if (pEntry.areaHectares > 0) {
          pEntry.yieldPerHectare = Math.round((pEntry.totalKg / pEntry.areaHectares) * 100) / 100;
        }
        if (area > 0) {
          totalHarvestedKgWithArea += kg;
          totalAreaWithHarvest += area;
        }
      }
    }
    const fieldProductivity = Array.from(fieldProductivityMap.values())
      .filter((fp) => fp.hasValidArea)
      .sort((a, b) => b.yieldPerHectare - a.yieldPerHectare);

    const overallProductivityKgPerHa = totalAreaWithHarvest > 0
      ? Math.round((totalHarvestedKgWithArea / totalAreaWithHarvest) * 100) / 100
      : null;

    // Tasks with filters
    const taskFilters = {};
    if (farmId) taskFilters.farmId = farmId;
    if (fieldId) taskFilters.fieldId = fieldId;
    const allTasks = await this.listTasks(ownerId, taskFilters);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let pendingTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;

    for (const t of allTasks) {
      if (t.status === 'completed') {
        completedTasks++;
      } else if (t.status === 'pending' || t.status === 'in_progress') {
        pendingTasks++;
        if (t.dueDate && new Date(t.dueDate).getTime() < todayStart) {
          overdueTasks++;
        }
      }
    }

    // Finances with filters
    const finFilters = {};
    if (farmId) finFilters.farmId = farmId;
    if (fieldId) finFilters.fieldId = fieldId;
    if (startDate) finFilters.startDate = startDate;
    if (endDate) finFilters.endDate = endDate;
    const financeSummary = await this.getFinanceSummary(ownerId, finFilters);
    const financeRecords = await this.listFinanceRecords(ownerId, finFilters);

    // Monthly Finances Aggregation (for Grouped Bar & Line Charts)
    const monthlyMap = new Map();
    for (const rec of financeRecords) {
      const d = new Date(rec.date);
      if (!isNaN(d.getTime())) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            monthKey,
            label,
            revenue: 0,
            expense: 0,
            netProfit: 0,
          });
        }
        const mEntry = monthlyMap.get(monthKey);
        const amt = Number(rec.amount) || 0;
        if (rec.type === 'revenue') {
          mEntry.revenue = Math.round((mEntry.revenue + amt) * 100) / 100;
        } else {
          mEntry.expense = Math.round((mEntry.expense + amt) * 100) / 100;
        }
        mEntry.netProfit = Math.round((mEntry.revenue - mEntry.expense) * 100) / 100;
      }
    }
    const monthlyFinances = Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Expense breakdown by category
    const expenseCategories = [];
    const catLabels = {
      seeds: 'Seeds & Planting Stock',
      fertilizer: 'Fertilizers & Nutrients',
      chemical: 'Crop Protection & Chemicals',
      labor: 'Labor & Wages',
      irrigation: 'Irrigation & Pumping',
      equipment: 'Machinery & Fuel',
      maintenance: 'Farm Repairs & Maintenance',
      other: 'Other Operational Inputs',
      harvest_sale: 'Crop Harvest Sales',
    };
    const totalExp = financeSummary.totalExpense || 0;
    for (const [cat, amt] of Object.entries(financeSummary.categoryBreakdown || {})) {
      if (cat !== 'harvest_sale' && amt > 0) {
        expenseCategories.push({
          category: cat,
          label: catLabels[cat] || cat,
          amount: amt,
          percentage: totalExp > 0 ? Math.round((amt / totalExp) * 1000) / 10 : 0,
        });
      }
    }
    expenseCategories.sort((a, b) => b.amount - a.amount);

    // Summary Metrics
    const totalRevenue = financeSummary.totalIncome || 0;
    const totalExpense = financeSummary.totalExpense || 0;
    const netProfit = Math.round((totalRevenue - totalExpense) * 100) / 100;
    const profitMargin = totalRevenue > 0
      ? Math.round(((totalRevenue - totalExpense) / totalRevenue) * 1000) / 10
      : (totalExpense > 0 ? -100 : 0);

    // Inventory
    const inventoryItems = await this.listInventoryItems(ownerId, farmId ? { farmId } : {});
    const lowStockCount = inventoryItems.filter(
      (item) => Number(item.quantity) <= Number(item.minThreshold || 0)
    ).length;

    return {
      farmCount: farmList.length,
      fieldCount: fields.length,
      totalAreaHectares: fields.reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0),
      cropCycles: {
        total: filteredCycles.length,
        active: activeCycles.length,
        completed: completedCycles.length,
        stageDistribution,
      },
      yields: cropYields,
      cropProduction,
      fieldProductivity,
      monthlyFinances,
      expensesByCategory: expenseCategories,
      summaryMetrics: {
        totalRevenue,
        totalExpense,
        netProfit,
        profitMargin,
        totalHarvestedKg,
        productivityKgPerHa: overallProductivityKgPerHa,
        completedHarvestsCount: completedCycles.length,
        activeCyclesCount: activeCycles.length,
      },
      tasks: {
        total: allTasks.length,
        pending: pendingTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      },
      finances: financeSummary,
      inventory: {
        totalItems: inventoryItems.length,
        lowStockCount,
      },
    };
  },
};

export default farmStore;
