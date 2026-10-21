import Farm from '../models/Farm.js';
import Field from '../models/Field.js';
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
    if (mode === 'mongodb') return Field.findOneAndDelete(ownedResourceFilter(fieldId, ownerId));
    if (mode !== 'local-json-development') throw unavailableError();

    const fields = readLocalCollection('fields');
    const field = fields.find(
      (item) => item._id === fieldId && item.ownerId === String(ownerId)
    );
    if (!field) return null;
    writeLocalCollection('fields', fields.filter((item) => item._id !== fieldId));
    return field;
  },
};

export default farmStore;
