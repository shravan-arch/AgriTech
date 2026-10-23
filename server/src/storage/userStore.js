import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
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
};

export default userStore;
