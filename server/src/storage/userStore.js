import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { getDBStatus } from '../config/db.js';
import { newLocalId, readLocalCollection, writeLocalCollection } from './localJsonStore.js';
import { ownedUserFilter } from './ownershipQueries.js';

const getStorageMode = () => getDBStatus().mode;
const unavailableError = () => new Error('Persistent storage is unavailable.');

const createLocalUser = (record, includePassword = false) => {
  const user = { ...record };
  if (!includePassword) delete user.password;
  if (includePassword) {
    user.comparePassword = (candidatePassword) =>
      bcrypt.compare(candidatePassword, user.password);
  }
  user.toJSON = () => {
    const { password, toJSON, comparePassword, ...safe } = user;
    return safe;
  };
  return user;
};

export const userStore = {
  async findByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const mode = getStorageMode();
    if (mode === 'mongodb') return User.findOne({ email: normalizedEmail });
    if (mode !== 'local-json-development') throw unavailableError();

    const record = readLocalCollection('users')
      .find((user) => user.email?.toLowerCase() === normalizedEmail);
    return record ? createLocalUser(record, true) : null;
  },

  async findById(id) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return User.findById(id).select('-password');
    if (mode !== 'local-json-development') throw unavailableError();

    const record = readLocalCollection('users')
      .find((user) => user.id === id || user._id === id);
    return record ? createLocalUser(record) : null;
  },

  async findOwnedById(id, requesterId, isAdmin = false) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findOne(ownedUserFilter(id, requesterId, isAdmin)).select('-password');
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const record = readLocalCollection('users')
      .find((user) => (user.id === id || user._id === id) &&
        (isAdmin || user.id === requesterId || user._id === requesterId));
    return record ? createLocalUser(record) : null;
  },

  async create(userData) {
    const mode = getStorageMode();
    if (mode === 'mongodb') return User.create(userData);
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const email = userData.email.toLowerCase().trim();
    if (users.some((user) => user.email?.toLowerCase() === email)) {
      const error = new Error('Duplicate email address.');
      error.code = 11000;
      throw error;
    }
    const now = new Date().toISOString();
    const record = {
      _id: newLocalId(),
      name: userData.name,
      email,
      password: await bcrypt.hash(userData.password, 10),
      role: 'farmer',
      ...(userData.farmName ? { farmName: userData.farmName } : {}),
      ...(userData.farmSizeHectares !== undefined
        ? { farmSizeHectares: userData.farmSizeHectares }
        : {}),
      primaryCrops: userData.primaryCrops || [],
      createdAt: now,
      updatedAt: now,
    };
    record.id = record._id;
    users.push(record);
    writeLocalCollection('users', users);
    return createLocalUser(record, true);
  },

  verifyPassword(user, candidatePassword) {
    if (typeof user.comparePassword === 'function') {
      return user.comparePassword(candidatePassword);
    }
    return bcrypt.compare(candidatePassword, user.password);
  },
};

export default userStore;
