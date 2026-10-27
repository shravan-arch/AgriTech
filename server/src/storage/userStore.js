import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import PlatformSetting from '../models/PlatformSetting.js';
import Notification from '../models/Notification.js';
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
import WeatherSnapshot from '../models/WeatherSnapshot.js';
import SupportTicket from '../models/SupportTicket.js';
import ServiceBooking from '../models/ServiceBooking.js';
import PolicyViolation from '../models/PolicyViolation.js';
import PurchaseRecord from '../models/PurchaseRecord.js';
import photoStorage from './photoStorage.js';
import { getDBStatus } from '../config/db.js';
import { newLocalId, readLocalCollection, writeLocalCollection } from './localJsonStore.js';
import { ownedUserFilter } from './ownershipQueries.js';

const getStorageMode = () => getDBStatus().mode;
const unavailableError = () => new Error('Persistent storage is unavailable.');

const createLocalUser = (record, includePassword = false) => {
  const user = { ...record };
  if (!includePassword) delete user.password;
  if (includePassword && user.password) {
    user.comparePassword = (candidatePassword) =>
      bcrypt.compare(candidatePassword, user.password);
  } else if (includePassword) {
    user.comparePassword = async () => false;
  }
  user.toJSON = () => {
    const { password, resetPasswordToken, resetPasswordExpires, emailVerificationToken, emailVerificationExpires, toJSON, comparePassword, ...safe } = user;
    return safe;
  };
  return user;
};

export const userStore = {
  async findByEmail(email, { includeSecrets = false } = {}) {
    const normalizedEmail = email.toLowerCase().trim();
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = User.findOne({ email: normalizedEmail });
      if (includeSecrets) query.select('+resetPasswordToken +resetPasswordExpires +emailVerificationToken +emailVerificationExpires');
      return query;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const record = readLocalCollection('users')
      .find((user) => user.email?.toLowerCase() === normalizedEmail);
    return record ? createLocalUser(record, true) : null;
  },

  async findByGoogleId(googleId) {
    if (!googleId) return null;
    const mode = getStorageMode();
    if (mode === 'mongodb') return User.findOne({ googleId });
    if (mode !== 'local-json-development') throw unavailableError();

    const record = readLocalCollection('users')
      .find((user) => user.googleId === googleId);
    return record ? createLocalUser(record, true) : null;
  },

  async linkGoogleAccount(userId, googleId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findByIdAndUpdate(userId, { googleId, emailVerified: true }, { new: true });
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === userId || u._id === userId);
    if (index === -1) return null;
    users[index].googleId = googleId;
    users[index].emailVerified = true;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
  },

  async findById(id, { includePassword = false } = {}) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const query = User.findById(id);
      if (!includePassword) query.select('-password');
      return query;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const record = readLocalCollection('users')
      .find((user) => user.id === id || user._id === id);
    return record ? createLocalUser(record, includePassword) : null;
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

  async setResetPasswordToken(userId, hashedToken, expiresAt) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findByIdAndUpdate(
        userId,
        {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: expiresAt,
        },
        { new: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === userId || u._id === userId);
    if (index === -1) return null;
    users[index].resetPasswordToken = hashedToken;
    users[index].resetPasswordExpires = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
  },

  async findByResetToken(hashedToken) {
    if (!hashedToken) return null;
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      }).select('+resetPasswordToken +resetPasswordExpires');
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date();
    const record = readLocalCollection('users').find(
      (user) => user.resetPasswordToken === hashedToken &&
        user.resetPasswordExpires &&
        new Date(user.resetPasswordExpires) > now
    );
    return record ? createLocalUser(record, true) : null;
  },

  async resetPasswordWithToken(userId, newPassword) {
    const mode = getStorageMode();
    const now = new Date();
    if (mode === 'mongodb') {
      const user = await User.findById(userId);
      if (!user) return null;
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.passwordChangedAt = now;
      await user.save();
      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === userId || u._id === userId);
    if (index === -1) return null;

    users[index].password = await bcrypt.hash(newPassword, 10);
    delete users[index].resetPasswordToken;
    delete users[index].resetPasswordExpires;
    users[index].passwordChangedAt = now.toISOString();
    users[index].updatedAt = now.toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
  },

  async setEmailVerificationToken(userId, hashedToken, expiresAt) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findByIdAndUpdate(
        userId,
        {
          emailVerificationToken: hashedToken,
          emailVerificationExpires: expiresAt,
        },
        { new: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === userId || u._id === userId);
    if (index === -1) return null;
    if (hashedToken) {
      users[index].emailVerificationToken = hashedToken;
      users[index].emailVerificationExpires = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
    } else {
      delete users[index].emailVerificationToken;
      delete users[index].emailVerificationExpires;
    }
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
  },

  async findByVerificationToken(hashedToken) {
    if (!hashedToken) return null;
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() },
      }).select('+emailVerificationToken +emailVerificationExpires');
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const now = new Date();
    const record = readLocalCollection('users').find(
      (user) => user.emailVerificationToken === hashedToken &&
        user.emailVerificationExpires &&
        new Date(user.emailVerificationExpires) > now
    );
    return record ? createLocalUser(record, true) : null;
  },

  async verifyEmailWithToken(userId, hashedToken) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.findOneAndUpdate(
        {
          _id: userId,
          emailVerificationToken: hashedToken,
          emailVerificationExpires: { $gt: new Date() },
        },
        {
          $set: { emailVerified: true },
          $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 },
        },
        { new: true }
      );
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const now = new Date();
    const index = users.findIndex(
      (u) => (u.id === userId || u._id === userId) &&
        u.emailVerificationToken === hashedToken &&
        u.emailVerificationExpires &&
        new Date(u.emailVerificationExpires) > now
    );
    if (index === -1) return null;
    users[index].emailVerified = true;
    delete users[index].emailVerificationToken;
    delete users[index].emailVerificationExpires;
    users[index].updatedAt = now.toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
  },

  async updateUnverifiedUser(userId, updateData) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(userId);
      if (!user || user.emailVerified) return null;
      if (updateData.password) {
        user.password = updateData.password;
      }
      if (updateData.name) user.name = updateData.name;
      if (updateData.farmName !== undefined) user.farmName = updateData.farmName;
      if (updateData.farmSizeHectares !== undefined) user.farmSizeHectares = updateData.farmSizeHectares;
      if (updateData.primaryCrops !== undefined) user.primaryCrops = updateData.primaryCrops;
      if (updateData.emailVerificationToken !== undefined) user.emailVerificationToken = updateData.emailVerificationToken;
      if (updateData.emailVerificationExpires !== undefined) user.emailVerificationExpires = updateData.emailVerificationExpires;
      await user.save();
      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => (u.id === userId || u._id === userId) && !u.emailVerified);
    if (index === -1) return null;
    if (updateData.password) {
      users[index].password = await bcrypt.hash(updateData.password, 10);
    }
    if (updateData.name) users[index].name = updateData.name;
    if (updateData.farmName !== undefined) users[index].farmName = updateData.farmName;
    if (updateData.farmSizeHectares !== undefined) users[index].farmSizeHectares = updateData.farmSizeHectares;
    if (updateData.primaryCrops !== undefined) users[index].primaryCrops = updateData.primaryCrops;
    if (updateData.emailVerificationToken !== undefined) users[index].emailVerificationToken = updateData.emailVerificationToken;
    if (updateData.emailVerificationExpires !== undefined) {
      users[index].emailVerificationExpires = updateData.emailVerificationExpires instanceof Date
        ? updateData.emailVerificationExpires.toISOString()
        : updateData.emailVerificationExpires;
    }
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
  },

  async updateProfile(userId, updateData) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const allowed = ['name', 'phone', 'address', 'farmName', 'farmSizeHectares', 'primaryCrops', 'language'];
      const updateObj = {};
      for (const key of allowed) {
        if (updateData[key] !== undefined) {
          updateObj[key] = updateData[key];
        }
      }
      return User.findByIdAndUpdate(userId, updateObj, { new: true, runValidators: true }).select('-password');
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === userId || u._id === userId);
    if (index === -1) return null;
    if (updateData.name !== undefined) users[index].name = updateData.name;
    if (updateData.phone !== undefined) users[index].phone = updateData.phone;
    if (updateData.address !== undefined) users[index].address = updateData.address;
    if (updateData.farmName !== undefined) users[index].farmName = updateData.farmName;
    if (updateData.farmSizeHectares !== undefined) users[index].farmSizeHectares = updateData.farmSizeHectares;
    if (updateData.primaryCrops !== undefined) users[index].primaryCrops = updateData.primaryCrops;
    if (updateData.language !== undefined) users[index].language = updateData.language;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    return createLocalUser(users[index]);
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
      ...(userData.password ? { password: await bcrypt.hash(userData.password, 10) } : {}),
      ...(userData.googleId ? { googleId: userData.googleId } : {}),
      role: userData.role || 'farmer',
      status: userData.status || 'active',
      roleRequest: userData.roleRequest || { status: 'none' },
      language: userData.language || 'en',
      emailVerified: userData.emailVerified === true,
      ...(userData.emailVerificationToken ? { emailVerificationToken: userData.emailVerificationToken } : {}),
      ...(userData.emailVerificationExpires
        ? {
            emailVerificationExpires:
              userData.emailVerificationExpires instanceof Date
                ? userData.emailVerificationExpires.toISOString()
                : userData.emailVerificationExpires,
          }
        : {}),
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

  async countActiveAdmins() {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.countDocuments({ role: 'admin', status: { $ne: 'suspended' } });
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    return users.filter((u) => u.role === 'admin' && (u.status || 'active') !== 'suspended').length;
  },

  async listUsers({ role, status, pendingOnly = false, search = '', limit = 50, page = 1 } = {}) {
    const mode = getStorageMode();
    const skip = Math.max(0, (page - 1) * limit);

    if (mode === 'mongodb') {
      const query = {};
      if (role) query.role = role;
      if (status) query.status = status;
      if (pendingOnly) query['roleRequest.status'] = 'pending';
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ name: regex }, { email: regex }, { farmName: regex }];
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query),
      ]);

      return { users, total, page, pages: Math.ceil(total / limit) || 1 };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    let users = readLocalCollection('users');
    if (role) users = users.filter((u) => u.role === role);
    if (status) users = users.filter((u) => (u.status || 'active') === status);
    if (pendingOnly) users = users.filter((u) => u.roleRequest?.status === 'pending');
    if (search) {
      const lower = search.toLowerCase();
      users = users.filter((u) =>
        u.name?.toLowerCase().includes(lower) ||
        u.email?.toLowerCase().includes(lower) ||
        u.farmName?.toLowerCase().includes(lower)
      );
    }
    const total = users.length;
    const paginated = users.slice(skip, skip + limit).map((u) => createLocalUser(u));
    return { users: paginated, total, page, pages: Math.ceil(total / limit) || 1 };
  },

  async updateUserRole({ targetUserId, newRole, actor, reason = '', ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(targetUserId);
      if (!user) return null;

      const previousRole = user.role;
      if (previousRole === 'admin' && newRole !== 'admin') {
        const activeAdmins = await this.countActiveAdmins();
        if (activeAdmins <= 1 && user.status !== 'suspended') {
          const err = new Error('Cannot demote the last active administrator.');
          err.code = 'LAST_ADMIN_PROTECTION';
          throw err;
        }
      }

      user.role = newRole;
      user.roleChangedAt = new Date();
      user.tokenVersion = (user.tokenVersion || 0) + 1;

      if (newRole === 'admin') {
        user.farmName = '';
        user.farmSizeHectares = undefined;
        user.primaryCrops = [];
        try {
          await Farm.updateMany(
            { ownerId: String(targetUserId) },
            { $set: { previousOwnerId: String(targetUserId), ownerId: 'unassigned' } }
          );
        } catch {
          // Non-blocking farm dissociation
        }
      }

      if (user.roleRequest && user.roleRequest.status === 'pending' && newRole === 'admin') {
        user.roleRequest.status = 'approved';
        user.roleRequest.reviewedAt = new Date();
        user.roleRequest.reviewedBy = actor._id || actor.id;
        user.roleRequest.reviewNotes = reason || 'Approved by admin';
      }
      await user.save();

      await this.createAuditLog({
        action: 'ROLE_CHANGE',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        previousRole,
        newRole,
        reason,
        ipAddress,
      });

      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === targetUserId || u._id === targetUserId);
    if (index === -1) return null;

    const previousRole = users[index].role || 'farmer';
    if (previousRole === 'admin' && newRole !== 'admin') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1 && users[index].status !== 'suspended') {
        const err = new Error('Cannot demote the last active administrator.');
        err.code = 'LAST_ADMIN_PROTECTION';
        throw err;
      }
    }

    users[index].role = newRole;
    users[index].roleChangedAt = new Date().toISOString();
    users[index].tokenVersion = (users[index].tokenVersion || 0) + 1;

    if (newRole === 'admin') {
      users[index].farmName = '';
      users[index].farmSizeHectares = undefined;
      users[index].primaryCrops = [];
      try {
        const farms = readLocalCollection('farms');
        let farmsModified = false;
        farms.forEach((f) => {
          if (f.ownerId === String(targetUserId)) {
            f.previousOwnerId = f.ownerId;
            f.ownerId = 'unassigned';
            farmsModified = true;
          }
        });
        if (farmsModified) writeLocalCollection('farms', farms);
      } catch {
        // Non-blocking farm dissociation
      }
    }

    if (users[index].roleRequest?.status === 'pending' && newRole === 'admin') {
      users[index].roleRequest.status = 'approved';
      users[index].roleRequest.reviewedAt = new Date().toISOString();
      users[index].roleRequest.reviewedBy = actor.id || actor._id;
      users[index].roleRequest.reviewNotes = reason || 'Approved by admin';
    }
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: 'ROLE_CHANGE',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      previousRole,
      newRole,
      reason,
      ipAddress,
    });

    return createLocalUser(users[index]);
  },

  async changeUserRole(options) {
    return this.updateUserRole(options);
  },

  async changeUserStatus(options) {
    return this.updateUserStatus({
      ...options,
      status: options.newStatus || options.status,
    });
  },

  async approveRoleRequest(options) {
    return this.reviewRoleRequest({ ...options, decision: 'approved' });
  },

  async rejectRoleRequest(options) {
    return this.reviewRoleRequest({ ...options, decision: 'rejected' });
  },

  async reviewRoleRequest({ targetUserId, decision, actor, reason = '', ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(targetUserId);
      if (!user) return null;
      if (!user.roleRequest || user.roleRequest.status !== 'pending') {
        const err = new Error('User does not have a pending role request.');
        err.code = 'NO_PENDING_REQUEST';
        throw err;
      }

      const previousRole = user.role;
      let newRole = user.role;

      if (decision === 'approved') {
        newRole = user.roleRequest.requestedRole || 'admin';
        user.role = newRole;
        user.roleRequest.status = 'approved';
        user.roleChangedAt = new Date();
        user.tokenVersion = (user.tokenVersion || 0) + 1;

        if (newRole === 'admin') {
          user.farmName = '';
          user.farmSizeHectares = undefined;
          user.primaryCrops = [];
          try {
            await Farm.updateMany(
              { ownerId: String(targetUserId) },
              { $set: { previousOwnerId: String(targetUserId), ownerId: 'unassigned' } }
            );
          } catch {
            // Non-blocking farm dissociation
          }
        }
      } else {
        user.roleRequest.status = 'rejected';
      }

      user.roleRequest.reviewedAt = new Date();
      user.roleRequest.reviewedBy = actor._id || actor.id;
      user.roleRequest.reviewNotes = reason;
      await user.save();

      await this.createAuditLog({
        action: decision === 'approved' ? 'ROLE_REQUEST_APPROVED' : 'ROLE_REQUEST_REJECTED',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        previousRole,
        newRole,
        reason,
        ipAddress,
      });

      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === targetUserId || u._id === targetUserId);
    if (index === -1) return null;

    if (!users[index].roleRequest || users[index].roleRequest.status !== 'pending') {
      const err = new Error('User does not have a pending role request.');
      err.code = 'NO_PENDING_REQUEST';
      throw err;
    }

    const previousRole = users[index].role || 'farmer';
    let newRole = previousRole;

    if (decision === 'approved') {
      newRole = users[index].roleRequest.requestedRole || 'admin';
      users[index].role = newRole;
      users[index].roleRequest.status = 'approved';
      users[index].roleChangedAt = new Date().toISOString();
      users[index].tokenVersion = (users[index].tokenVersion || 0) + 1;

      if (newRole === 'admin') {
        users[index].farmName = '';
        users[index].farmSizeHectares = undefined;
        users[index].primaryCrops = [];
        try {
          const farms = readLocalCollection('farms');
          let farmsModified = false;
          farms.forEach((f) => {
            if (f.ownerId === String(targetUserId)) {
              f.previousOwnerId = f.ownerId;
              f.ownerId = 'unassigned';
              farmsModified = true;
            }
          });
          if (farmsModified) writeLocalCollection('farms', farms);
        } catch {
          // Non-blocking farm dissociation
        }
      }
    } else {
      users[index].roleRequest.status = 'rejected';
    }

    users[index].roleRequest.reviewedAt = new Date().toISOString();
    users[index].roleRequest.reviewedBy = actor.id || actor._id;
    users[index].roleRequest.reviewNotes = reason;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: decision === 'approved' ? 'ROLE_REQUEST_APPROVED' : 'ROLE_REQUEST_REJECTED',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      previousRole,
      newRole,
      reason,
      ipAddress,
    });

    return createLocalUser(users[index]);
  },

  async updateUserStatus({ targetUserId, status: newStatus, actor, reason = '', ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(targetUserId);
      if (!user) return null;

      const previousStatus = user.status || 'active';
      if (user.role === 'admin' && newStatus === 'suspended') {
        const activeAdmins = await this.countActiveAdmins();
        if (activeAdmins <= 1) {
          const err = new Error('Cannot suspend the last active administrator.');
          err.code = 'LAST_ADMIN_PROTECTION';
          throw err;
        }
      }

      user.status = newStatus;
      await user.save();

      await this.createAuditLog({
        action: newStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        previousStatus,
        newStatus,
        reason,
        ipAddress,
      });

      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === targetUserId || u._id === targetUserId);
    if (index === -1) return null;

    const previousStatus = users[index].status || 'active';
    if (users[index].role === 'admin' && newStatus === 'suspended') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        const err = new Error('Cannot suspend the last active administrator.');
        err.code = 'LAST_ADMIN_PROTECTION';
        throw err;
      }
    }

    users[index].status = newStatus;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: newStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      previousStatus,
      newStatus,
      reason,
      ipAddress,
    });

    return createLocalUser(users[index]);
  },

  async createAuditLog(data) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return AuditLog.create(data);
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const logs = readLocalCollection('audit_logs');
    const now = new Date().toISOString();
    const record = {
      _id: newLocalId(),
      id: undefined,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    record.id = record._id;
    logs.unshift(record);
    writeLocalCollection('audit_logs', logs);
    return record;
  },

  async listAuditLogs({ limit = 50, page = 1 } = {}) {
    const mode = getStorageMode();
    const skip = Math.max(0, (page - 1) * limit);

    if (mode === 'mongodb') {
      const [logs, total] = await Promise.all([
        AuditLog.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(),
      ]);
      return { logs, total, page, pages: Math.ceil(total / limit) || 1 };
    }
    if (mode !== 'local-json-development') throw unavailableError();

    const logs = readLocalCollection('audit_logs');
    const total = logs.length;
    const paginated = logs.slice(skip, skip + limit);
    return { logs: paginated, total, page, pages: Math.ceil(total / limit) || 1 };
  },

  async bootstrapFirstAdmin({ targetEmail, name, password, ipAddress = '' }) {
    const activeAdmins = await this.countActiveAdmins();
    if (activeAdmins > 0) {
      const err = new Error('An administrator already exists. Bootstrap is disabled.');
      err.code = 'BOOTSTRAP_DISABLED';
      throw err;
    }

    const normalizedEmail = targetEmail.trim().toLowerCase();
    const mode = getStorageMode();

    if (mode === 'mongodb') {
      let user = await User.findOne({ email: normalizedEmail });
      if (user) {
        const previousRole = user.role;
        user.role = 'admin';
        user.emailVerified = true;
        if (user.roleRequest) user.roleRequest.status = 'approved';
        await user.save();

        await this.createAuditLog({
          action: 'ADMIN_BOOTSTRAP',
          actorId: user._id,
          actorEmail: user.email,
          actorName: user.name,
          targetUserId: user._id,
          targetUserEmail: user.email,
          targetUserName: user.name,
          previousRole,
          newRole: 'admin',
          reason: 'Initial system administrator bootstrap',
          ipAddress,
        });

        return user;
      }

      if (!password) {
        const err = new Error('Password required to create new initial admin.');
        err.code = 'PASSWORD_REQUIRED';
        throw err;
      }

      user = await User.create({
        name: name || 'System Administrator',
        email: normalizedEmail,
        password,
        role: 'admin',
        emailVerified: true,
        status: 'active',
      });

      await this.createAuditLog({
        action: 'ADMIN_BOOTSTRAP',
        actorId: user._id,
        actorEmail: user.email,
        actorName: user.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        previousRole: 'none',
        newRole: 'admin',
        reason: 'Initial system administrator bootstrap creation',
        ipAddress,
      });

      return user;
    }

    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.email?.toLowerCase() === normalizedEmail);

    if (index !== -1) {
      const previousRole = users[index].role || 'farmer';
      users[index].role = 'admin';
      users[index].emailVerified = true;
      if (users[index].roleRequest) users[index].roleRequest.status = 'approved';
      users[index].updatedAt = new Date().toISOString();
      writeLocalCollection('users', users);

      await this.createAuditLog({
        action: 'ADMIN_BOOTSTRAP',
        actorId: users[index].id,
        actorEmail: users[index].email,
        actorName: users[index].name,
        targetUserId: users[index].id,
        targetUserEmail: users[index].email,
        targetUserName: users[index].name,
        previousRole,
        newRole: 'admin',
        reason: 'Initial system administrator bootstrap',
        ipAddress,
      });

      return createLocalUser(users[index]);
    }

    if (!password) {
      const err = new Error('Password required to create new initial admin.');
      err.code = 'PASSWORD_REQUIRED';
      throw err;
    }

    const user = await this.create({
      name: name || 'System Administrator',
      email: normalizedEmail,
      password,
      role: 'admin',
      emailVerified: true,
      status: 'active',
    });

    await this.createAuditLog({
      action: 'ADMIN_BOOTSTRAP',
      actorId: user._id || user.id,
      actorEmail: user.email,
      actorName: user.name,
      targetUserId: user._id || user.id,
      targetUserEmail: user.email,
      targetUserName: user.name,
      previousRole: 'none',
      newRole: 'admin',
      reason: 'Initial system administrator bootstrap creation',
      ipAddress,
    });

    return user;
  },

  verifyPassword(user, candidatePassword) {
    if (!user || !candidatePassword) return false;
    if (typeof user.comparePassword === 'function') {
      return user.comparePassword(candidatePassword);
    }
    if (!user.password) return false;
    return bcrypt.compare(candidatePassword, user.password);
  },

  async getUserDetails(userId) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(userId)
        .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires')
        .lean();
      if (!user) return null;
      const farmCount = await Farm.countDocuments({ ownerId: user._id });
      const fieldCount = await Field.countDocuments({ ownerId: user._id });
      return { ...user, farmCount, fieldCount };
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const u = users.find((item) => item._id === userId || item.id === userId);
    if (!u) return null;
    const farms = readLocalCollection('farms');
    const fields = readLocalCollection('fields');
    const farmCount = farms.filter((f) => String(f.ownerId) === String(userId)).length;
    const fieldCount = fields.filter((fld) => String(fld.ownerId) === String(userId)).length;
    const safe = createLocalUser(u);
    return { ...safe, farmCount, fieldCount };
  },

  async verifyUserEmailAdmin({ targetUserId, actor, reason = '', ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(targetUserId);
      if (!user) return null;
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      await this.createAuditLog({
        action: 'SUPPORT_EMAIL_VERIFIED',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        reason: reason || 'Email verified manually by administrator assistance',
        ipAddress,
      });

      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === targetUserId || u._id === targetUserId);
    if (index === -1) return null;
    users[index].emailVerified = true;
    delete users[index].emailVerificationToken;
    delete users[index].emailVerificationExpires;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: 'SUPPORT_EMAIL_VERIFIED',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      reason: reason || 'Email verified manually by administrator assistance',
      ipAddress,
    });

    return createLocalUser(users[index]);
  },

  async createPasswordResetAdmin({ targetUserId, actor, reason = '', ipAddress = '' }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(targetUserId);
      if (!user) return null;
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = expiresAt;
      await user.save();

      await this.createAuditLog({
        action: 'SUPPORT_PASSWORD_RESET',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        reason: reason || 'Password reset link generated by administrator assistance',
        ipAddress,
      });

      return { user, resetToken: rawToken };
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === targetUserId || u._id === targetUserId);
    if (index === -1) return null;
    users[index].resetPasswordToken = hashedToken;
    users[index].resetPasswordExpires = expiresAt.toISOString();
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: 'SUPPORT_PASSWORD_RESET',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      reason: reason || 'Password reset link generated by administrator assistance',
      ipAddress,
    });

    return { user: createLocalUser(users[index]), resetToken: rawToken };
  },

  async updateUserProfileAdmin({ targetUserId, profileData, actor, reason = '', ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(targetUserId);
      if (!user) return null;

      if (profileData.name !== undefined) user.name = profileData.name;
      if (profileData.phone !== undefined) user.phone = profileData.phone;
      if (profileData.address !== undefined) user.address = profileData.address;
      if (profileData.language !== undefined) user.language = profileData.language;
      if (profileData.farmName !== undefined) user.farmName = profileData.farmName;
      if (profileData.farmSizeHectares !== undefined) user.farmSizeHectares = profileData.farmSizeHectares;
      if (profileData.primaryCrops !== undefined) user.primaryCrops = profileData.primaryCrops;
      if (profileData.profilePhoto !== undefined) user.profilePhoto = profileData.profilePhoto;

      await user.save();

      await this.createAuditLog({
        action: 'ADMIN_PROFILE_UPDATE',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserName: user.name,
        reason: reason || 'Profile updated by administrator',
        ipAddress,
      });

      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === targetUserId || u._id === targetUserId);
    if (index === -1) return null;

    if (profileData.name !== undefined) users[index].name = profileData.name;
    if (profileData.phone !== undefined) users[index].phone = profileData.phone;
    if (profileData.address !== undefined) users[index].address = profileData.address;
    if (profileData.language !== undefined) users[index].language = profileData.language;
    if (profileData.farmName !== undefined) users[index].farmName = profileData.farmName;
    if (profileData.farmSizeHectares !== undefined) users[index].farmSizeHectares = profileData.farmSizeHectares;
    if (profileData.primaryCrops !== undefined) users[index].primaryCrops = profileData.primaryCrops;
    if (profileData.profilePhoto !== undefined) users[index].profilePhoto = profileData.profilePhoto;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: 'ADMIN_PROFILE_UPDATE',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      reason: reason || 'Profile updated by administrator',
      ipAddress,
    });

    return createLocalUser(users[index]);
  },

  async getPlatformSettings() {
    const mode = getStorageMode();
    const defaults = {
      key: 'default',
      supportedLanguages: ['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'],
      allowPublicRegistration: true,
      requireEmailVerification: false,
      maintenanceMode: false,
      systemNotice: '',
    };
    if (mode === 'mongodb') {
      const setting = await PlatformSetting.findOne({ key: 'default' });
      return setting ? setting.toObject() : defaults;
    }
    if (mode !== 'local-json-development') return defaults;
    const settings = readLocalCollection('platform_settings');
    return settings[0] || defaults;
  },

  async updatePlatformSettings(settingsData, actor, ipAddress = '') {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const updated = await PlatformSetting.findOneAndUpdate(
        { key: 'default' },
        {
          $set: {
            ...settingsData,
            updatedBy: actor._id || actor.id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await this.createAuditLog({
        action: 'PLATFORM_SETTINGS_UPDATE',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        reason: 'Platform settings updated by administrator',
        ipAddress,
      });

      return updated.toObject ? updated.toObject() : updated;
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const settings = readLocalCollection('platform_settings');
    const existing = settings[0] || { key: 'default' };
    const merged = {
      ...existing,
      ...settingsData,
      updatedBy: actor.id || actor._id,
      updatedAt: new Date().toISOString(),
    };
    writeLocalCollection('platform_settings', [merged]);

    await this.createAuditLog({
      action: 'PLATFORM_SETTINGS_UPDATE',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      reason: 'Platform settings updated by administrator',
      ipAddress,
    });

    return merged;
  },

  async createAnnouncement({ title, message, severity = 'info', actor, ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const users = await User.find({ status: { $ne: 'suspended' } }).select('_id');
      const notifications = users.map((u) => ({
        ownerId: u._id,
        userId: u._id,
        title,
        message,
        type: 'system',
        severity: ['info', 'warning', 'critical'].includes(severity) ? severity : 'info',
        read: false,
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      await this.createAuditLog({
        action: 'SYSTEM_ANNOUNCEMENT',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        reason: `Broadcast announcement: ${title}`,
        ipAddress,
      });

      return { count: notifications.length, title, severity };
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users').filter((u) => (u.status || 'active') !== 'suspended');
    const notifications = readLocalCollection('notifications');
    const now = new Date().toISOString();
    let count = 0;
    for (const u of users) {
      const uid = u._id || u.id;
      const notif = {
        _id: newLocalId(),
        id: undefined,
        ownerId: uid,
        userId: uid,
        title,
        message,
        type: 'system',
        severity: ['info', 'warning', 'critical'].includes(severity) ? severity : 'info',
        read: false,
        createdAt: now,
        updatedAt: now,
      };
      notif.id = notif._id;
      notifications.unshift(notif);
      count++;
    }
    writeLocalCollection('notifications', notifications);

    await this.createAuditLog({
      action: 'SYSTEM_ANNOUNCEMENT',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      reason: `Broadcast announcement: ${title}`,
      ipAddress,
    });

    return { count, title, severity };
  },

  async getSystemHealth() {
    const mode = getStorageMode();
    const uptimeSeconds = Math.floor(process.uptime());
    const memory = process.memoryUsage();

    if (mode === 'mongodb') {
      const [totalUsers, activeUsers, suspendedUsers, activeAdmins, recentAuthFailures] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ status: { $ne: 'suspended' } }),
          User.countDocuments({ status: 'suspended' }),
          User.countDocuments({ role: 'admin', status: { $ne: 'suspended' } }),
          AuditLog.countDocuments({
            action: 'AUTH_FAILURE',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          }),
        ]);

      return {
        status: 'healthy',
        databaseMode: mode,
        uptimeSeconds,
        memoryUsageMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        totalUsers,
        activeUsers,
        suspendedUsers,
        activeAdmins,
        recentAuthFailures,
        timestamp: new Date().toISOString(),
      };
    }

    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const auditLogs = readLocalCollection('audit_logs');
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => (u.status || 'active') !== 'suspended').length;
    const suspendedUsers = users.filter((u) => u.status === 'suspended').length;
    const activeAdmins = users.filter((u) => u.role === 'admin' && (u.status || 'active') !== 'suspended').length;
    const recentAuthFailures = auditLogs.filter(
      (log) => log.action === 'AUTH_FAILURE' && (log.createdAt || '') >= dayAgo
    ).length;

    return {
      status: 'healthy',
      databaseMode: mode,
      uptimeSeconds,
      memoryUsageMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      totalUsers,
      activeUsers,
      suspendedUsers,
      activeAdmins,
      recentAuthFailures,
      timestamp: new Date().toISOString(),
    };
  },

  async updateFarmExceptional({ farmId, updates, reason, actor, ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const farm = await Farm.findById(farmId);
      if (!farm) return null;

      if (updates.name) farm.name = updates.name.trim();
      if (updates.location) {
        farm.location = { ...(farm.location?.toObject?.() || farm.location), ...updates.location };
      }
      await farm.save();

      await this.createAuditLog({
        action: 'ADMIN_FARM_UPDATE',
        actorId: actor._id || actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        targetUserId: farm.ownerId,
        reason: reason || 'Exceptional farm administrative maintenance',
        ipAddress,
      });

      return farm;
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const farms = readLocalCollection('farms');
    const index = farms.findIndex((f) => f._id === farmId || f.id === farmId);
    if (index === -1) return null;

    if (updates.name) farms[index].name = updates.name.trim();
    if (updates.location) {
      farms[index].location = { ...(farms[index].location || {}), ...updates.location };
    }
    farms[index].updatedAt = new Date().toISOString();
    writeLocalCollection('farms', farms);

    await this.createAuditLog({
      action: 'ADMIN_FARM_UPDATE',
      actorId: actor.id || actor._id,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId: farms[index].ownerId,
      reason: reason || 'Exceptional farm administrative maintenance',
      ipAddress,
    });

    return farms[index];
  },

  async countActiveAdmins() {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      return User.countDocuments({ role: 'admin', status: { $ne: 'suspended' } });
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    return users.filter((u) => u.role === 'admin' && (u.status || 'active') !== 'suspended').length;
  },

  async bootstrapAdmin({ email, password, name, ipAddress = '' }) {
    const mode = getStorageMode();
    const normalizedEmail = email.toLowerCase().trim();

    // Check if any active admin already exists
    const adminCount = await this.countActiveAdmins();
    if (adminCount > 0) {
      const err = new Error('An active administrator is already configured in the system.');
      err.code = 'BOOTSTRAP_DISABLED';
      throw err;
    }

    if (mode === 'mongodb') {
      let user = await User.findOne({ email: normalizedEmail });
      if (user) {
        user.name = name.trim();
        user.password = password;
        user.role = 'admin';
        user.emailVerified = true;
        user.status = 'active';
        await user.save();
      } else {
        user = await User.create({
          name: name.trim(),
          email: normalizedEmail,
          password,
          role: 'admin',
          emailVerified: true,
          status: 'active',
        });
      }

      await this.createAuditLog({
        action: 'SYSTEM_BOOTSTRAP',
        actorId: user._id,
        actorEmail: user.email,
        actorName: user.name,
        reason: 'Initial root administrator established via system bootstrap',
        ipAddress,
      });

      return user.toJSON ? user.toJSON() : user;
    }

    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    let recordIndex = users.findIndex((u) => u.email?.toLowerCase() === normalizedEmail);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();

    let savedRecord;
    if (recordIndex !== -1) {
      users[recordIndex] = {
        ...users[recordIndex],
        name: name.trim(),
        password: hashedPassword,
        role: 'admin',
        emailVerified: true,
        status: 'active',
        updatedAt: now,
      };
      savedRecord = users[recordIndex];
    } else {
      const id = newLocalId();
      savedRecord = {
        _id: id,
        id,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'admin',
        emailVerified: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      users.push(savedRecord);
    }
    writeLocalCollection('users', users);

    await this.createAuditLog({
      action: 'SYSTEM_BOOTSTRAP',
      actorId: savedRecord.id,
      actorEmail: savedRecord.email,
      actorName: savedRecord.name,
      reason: 'Initial root administrator established via system bootstrap',
      ipAddress,
    });

    return createLocalUser(savedRecord, false);
  },

  async bootstrapFirstAdmin(options) {
    const { targetEmail, name, password, ipAddress } = options;
    return this.bootstrapAdmin({ email: targetEmail, name, password, ipAddress });
  },

  async updateAdminSelfProfile({ adminId, updates, ipAddress }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(adminId);
      if (!user) return null;
      if (updates.name !== undefined) user.name = updates.name;
      if (updates.phone !== undefined) user.phone = updates.phone;
      if (updates.address !== undefined) user.address = updates.address;
      if (updates.language !== undefined) user.language = updates.language;
      if (updates.profilePhoto !== undefined) user.profilePhoto = updates.profilePhoto;
      await user.save();
      await this.createAuditLog({
        action: 'ADMIN_SELF_PROFILE_UPDATE',
        actorId: adminId,
        actorEmail: user.email,
        actorName: user.name,
        targetUserId: adminId,
        targetUserEmail: user.email,
        targetUserName: user.name,
        reason: 'Admin updated personal profile details',
        ipAddress,
      });
      return user;
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === adminId || u._id === adminId);
    if (index === -1) return null;
    if (updates.name !== undefined) users[index].name = updates.name;
    if (updates.phone !== undefined) users[index].phone = updates.phone;
    if (updates.address !== undefined) users[index].address = updates.address;
    if (updates.language !== undefined) users[index].language = updates.language;
    if (updates.profilePhoto !== undefined) users[index].profilePhoto = updates.profilePhoto;
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    await this.createAuditLog({
      action: 'ADMIN_SELF_PROFILE_UPDATE',
      actorId: adminId,
      actorEmail: users[index].email,
      actorName: users[index].name,
      targetUserId: adminId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      reason: 'Admin updated personal profile details',
      ipAddress,
    });
    return createLocalUser(users[index]);
  },

  async updateAdminPassword({ adminId, currentPassword, newPassword, ipAddress }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(adminId);
      if (!user) return { success: false, code: 'USER_NOT_FOUND', message: 'User not found.' };
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return { success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' };
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      await user.save();
      await this.createAuditLog({
        action: 'ADMIN_PASSWORD_CHANGED',
        actorId: adminId,
        actorEmail: user.email,
        actorName: user.name,
        targetUserId: adminId,
        targetUserEmail: user.email,
        targetUserName: user.name,
        reason: 'Admin changed password via secure authentication flow',
        ipAddress,
      });
      return { success: true };
    }
    if (mode !== 'local-json-development') throw unavailableError();
    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === adminId || u._id === adminId);
    if (index === -1) return { success: false, code: 'USER_NOT_FOUND', message: 'User not found.' };
    const isMatch = await bcrypt.compare(currentPassword, users[index].password);
    if (!isMatch) return { success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' };
    users[index].password = await bcrypt.hash(newPassword, 10);
    users[index].passwordChangedAt = new Date().toISOString();
    users[index].updatedAt = new Date().toISOString();
    writeLocalCollection('users', users);
    await this.createAuditLog({
      action: 'ADMIN_PASSWORD_CHANGED',
      actorId: adminId,
      actorEmail: users[index].email,
      actorName: users[index].name,
      targetUserId: adminId,
      targetUserEmail: users[index].email,
      targetUserName: users[index].name,
      reason: 'Admin changed password via secure authentication flow',
      ipAddress,
    });
    return { success: true };
  },

  async deleteAccount({ userId, actor, reason = 'User requested permanent account deletion', ipAddress = '' }) {
    const mode = getStorageMode();
    if (mode === 'mongodb') {
      const user = await User.findById(userId);
      if (!user) return null;

      // Prevent deletion of the last active administrator
      if (user.role === 'admin' && user.status !== 'suspended') {
        const activeAdmins = await this.countActiveAdmins();
        if (activeAdmins <= 1) {
          const err = new Error('Cannot delete the last active administrator account. Another active administrator must exist or be appointed first.');
          err.code = 'LAST_ADMIN_PROTECTION';
          throw err;
        }
      }

      // 1. External files: Find all photos owned by user and delete physical files
      const photos = await FieldPhoto.find({ ownerId: user._id });
      await Promise.all(
        photos.map((p) =>
          photoStorage.deletePhoto({ storageKey: p.storageKey, storageProvider: p.storageProvider }).catch(() => {})
        )
      );
      await photoStorage.deleteUserPhotoDirectory(user._id).catch(() => {});

      // 2. Cascade delete all user-owned records across collections
      await Promise.all([
        FieldPhoto.deleteMany({ ownerId: user._id }),
        FarmActivity.deleteMany({ ownerId: user._id }),
        Task.deleteMany({ ownerId: user._id }),
        CropCycle.deleteMany({ ownerId: user._id }),
        Field.deleteMany({ ownerId: user._id }),
        Farm.deleteMany({ ownerId: user._id }),
        FinanceRecord.deleteMany({ ownerId: user._id }),
        InventoryMovement.deleteMany({ ownerId: user._id }),
        InventoryItem.deleteMany({ ownerId: user._id }),
        SensorReading.deleteMany({ ownerId: user._id }),
        Sensor.deleteMany({ ownerId: user._id }),
        Notification.deleteMany({ $or: [{ ownerId: user._id }, { userId: user._id }] }),
        WeatherSnapshot.deleteMany({ ownerId: user._id }),
        SupportTicket.deleteMany({ userId: user._id }),
        ServiceBooking.deleteMany({ farmerId: user._id }),
        PolicyViolation.deleteMany({ userId: user._id }),
        PurchaseRecord.deleteMany({ ownerId: user._id }),
      ]);

      // Unset previousOwnerId from farms
      await Farm.updateMany({ previousOwnerId: String(user._id) }, { $unset: { previousOwnerId: 1 } }).catch(() => {});

      // 3. Redact personal identifiable information from AuditLog
      await Promise.all([
        AuditLog.updateMany(
          { targetUserId: user._id },
          { $set: { targetUserEmail: '[Deleted User]', targetUserName: '[Deleted User]' } }
        ),
        AuditLog.updateMany(
          { actorId: user._id },
          { $set: { actorEmail: '[Deleted User]', actorName: '[Deleted User]' } }
        ),
      ]).catch(() => {});

      await this.createAuditLog({
        action: 'ACCOUNT_DELETED',
        actorId: actor?._id || actor?.id || user._id,
        actorEmail: '[Deleted User]',
        actorName: '[Deleted User]',
        targetUserId: user._id,
        targetUserEmail: '[Deleted User]',
        targetUserName: '[Deleted User]',
        previousRole: user.role,
        reason,
        ipAddress,
      }).catch(() => {});

      // 4. Delete the User record
      await User.findByIdAndDelete(user._id);

      return { success: true, deletedUserId: String(user._id) };
    }

    if (mode !== 'local-json-development') throw unavailableError();

    const users = readLocalCollection('users');
    const index = users.findIndex((u) => u.id === userId || u._id === userId);
    if (index === -1) return null;

    const user = users[index];
    const targetIdStr = String(user.id || user._id);

    if (user.role === 'admin' && (user.status || 'active') !== 'suspended') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        const err = new Error('Cannot delete the last active administrator account. Another active administrator must exist or be appointed first.');
        err.code = 'LAST_ADMIN_PROTECTION';
        throw err;
      }
    }

    // 1. External files
    const allPhotos = readLocalCollection('field_photos');
    const userPhotos = allPhotos.filter((p) => String(p.ownerId) === targetIdStr);
    await Promise.all(
      userPhotos.map((p) =>
        photoStorage.deletePhoto({ storageKey: p.storageKey, storageProvider: p.storageProvider }).catch(() => {})
      )
    );
    await photoStorage.deleteUserPhotoDirectory(targetIdStr).catch(() => {});

    // 2. Cascade delete records from local collections
    const collectionsToClean = [
      { name: 'field_photos', key: 'ownerId' },
      { name: 'farm_activities', key: 'ownerId' },
      { name: 'tasks', key: 'ownerId' },
      { name: 'crop_cycles', key: 'ownerId' },
      { name: 'fields', key: 'ownerId' },
      { name: 'farms', key: 'ownerId' },
      { name: 'finance_records', key: 'ownerId' },
      { name: 'inventory_movements', key: 'ownerId' },
      { name: 'inventory_items', key: 'ownerId' },
      { name: 'sensor_readings', key: 'ownerId' },
      { name: 'sensors', key: 'ownerId' },
      { name: 'weather_snapshots', key: 'ownerId' },
      { name: 'support_tickets', key: 'userId' },
      { name: 'service_bookings', key: 'farmerId' },
      { name: 'policy_violations', key: 'userId' },
      { name: 'purchases', key: 'ownerId' },
    ];

    for (const { name, key } of collectionsToClean) {
      const records = readLocalCollection(name);
      const remaining = records.filter((r) => String(r[key]) !== targetIdStr);
      if (remaining.length !== records.length) {
        writeLocalCollection(name, remaining);
      }
    }

    const notifs = readLocalCollection('notifications');
    const remNotifs = notifs.filter((n) => String(n.ownerId) !== targetIdStr && String(n.userId) !== targetIdStr);
    if (remNotifs.length !== notifs.length) {
      writeLocalCollection('notifications', remNotifs);
    }

    const allFarms = readLocalCollection('farms');
    let farmsModified = false;
    allFarms.forEach((f) => {
      if (String(f.previousOwnerId) === targetIdStr) {
        delete f.previousOwnerId;
        farmsModified = true;
      }
    });
    if (farmsModified) writeLocalCollection('farms', allFarms);

    // 3. Redact audit logs
    const auditLogs = readLocalCollection('audit_logs');
    let logsModified = false;
    auditLogs.forEach((l) => {
      if (String(l.targetUserId) === targetIdStr) {
        l.targetUserEmail = '[Deleted User]';
        l.targetUserName = '[Deleted User]';
        logsModified = true;
      }
      if (String(l.actorId) === targetIdStr) {
        l.actorEmail = '[Deleted User]';
        l.actorName = '[Deleted User]';
        logsModified = true;
      }
    });
    if (logsModified) writeLocalCollection('audit_logs', auditLogs);

    await this.createAuditLog({
      action: 'ACCOUNT_DELETED',
      actorId: actor?.id || actor?._id || targetIdStr,
      actorEmail: '[Deleted User]',
      actorName: '[Deleted User]',
      targetUserId: targetIdStr,
      targetUserEmail: '[Deleted User]',
      targetUserName: '[Deleted User]',
      previousRole: user.role,
      reason,
      ipAddress,
    }).catch(() => {});

    // 4. Delete user record
    users.splice(index, 1);
    writeLocalCollection('users', users);

    return { success: true, deletedUserId: targetIdStr };
  },
};

export default userStore;
