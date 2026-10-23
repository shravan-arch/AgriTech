import defaultUserStore from '../storage/userStore.js';

const getClientIp = (req) => {
  let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  if (typeof ip === 'string') {
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    if (ip === '::1') {
      ip = '127.0.0.1';
    }
  }
  return ip;
};

export const createAdminController = (userStore = defaultUserStore) => {
  return {
    listUsers: async (req, res, next) => {
      try {
        const { role, status, pendingOnly, search, limit, page } = req.query;
        const result = await userStore.listUsers({
          role: role?.trim(),
          status: status?.trim(),
          pendingOnly: pendingOnly === 'true' || pendingOnly === true,
          search: search?.trim(),
          limit: limit ? parseInt(limit, 10) : 50,
          page: page ? parseInt(page, 10) : 1,
        });

        return res.status(200).json({
          success: true,
          ...result,
        });
      } catch (error) {
        return next(error);
      }
    },

    listPendingRequests: async (req, res, next) => {
      try {
        const result = await userStore.listUsers({
          pendingOnly: true,
          limit: 100,
          page: 1,
        });

        return res.status(200).json({
          success: true,
          requests: result.users,
          total: result.total,
        });
      } catch (error) {
        return next(error);
      }
    },

    approveRoleRequest: async (req, res, next) => {
      try {
        const targetUserId = req.params.id;
        const actorId = req.user._id ? req.user._id.toString() : req.user.id?.toString();

        if (targetUserId === actorId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Administrators cannot approve their own role requests.',
          });
        }

        const reason = req.body?.reason?.trim() || 'Role request approved by administrator';
        const user = await userStore.reviewRoleRequest({
          targetUserId,
          decision: 'approved',
          actor: req.user,
          reason,
          ipAddress: getClientIp(req),
        });

        if (!user) {
          return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
        }

        return res.status(200).json({
          success: true,
          message: 'Admin role request approved successfully.',
          user,
        });
      } catch (error) {
        if (error.code === 'NO_PENDING_REQUEST') {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
        return next(error);
      }
    },

    rejectRoleRequest: async (req, res, next) => {
      try {
        const targetUserId = req.params.id;
        const actorId = req.user._id ? req.user._id.toString() : req.user.id?.toString();

        if (targetUserId === actorId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Administrators cannot reject their own role requests.',
          });
        }

        const reason = req.body?.reason?.trim() || 'Role request rejected by administrator';
        const user = await userStore.reviewRoleRequest({
          targetUserId,
          decision: 'rejected',
          actor: req.user,
          reason,
          ipAddress: getClientIp(req),
        });

        if (!user) {
          return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
        }

        return res.status(200).json({
          success: true,
          message: 'Admin role request rejected.',
          user,
        });
      } catch (error) {
        if (error.code === 'NO_PENDING_REQUEST') {
          return res.status(400).json({ error: 'Bad Request', message: error.message });
        }
        return next(error);
      }
    },

    changeUserRole: async (req, res, next) => {
      try {
        const targetUserId = req.params.id;
        const actorId = req.user._id ? req.user._id.toString() : req.user.id?.toString();

        if (targetUserId === actorId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Administrators cannot modify their own role. Another administrator must make this change.',
          });
        }

        const { role: newRole, reason } = req.body || {};
        if (!newRole || !['farmer', 'user', 'admin'].includes(newRole)) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Role must be either user or admin.',
          });
        }

        const targetRole = newRole === 'user' ? 'farmer' : newRole;

        const user = await userStore.updateUserRole({
          targetUserId,
          newRole: targetRole,
          actor: req.user,
          reason: reason?.trim() || `Role changed to ${newRole} by admin`,
          ipAddress: getClientIp(req),
        });

        if (!user) {
          return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
        }

        return res.status(200).json({
          success: true,
          message: `User role successfully updated to ${newRole}.`,
          user,
        });
      } catch (error) {
        if (error.code === 'LAST_ADMIN_PROTECTION') {
          return res.status(400).json({
            error: 'Bad Request',
            code: 'LAST_ADMIN_PROTECTION',
            message: error.message,
          });
        }
        return next(error);
      }
    },

    changeUserStatus: async (req, res, next) => {
      try {
        const targetUserId = req.params.id;
        const actorId = req.user._id ? req.user._id.toString() : req.user.id?.toString();

        if (targetUserId === actorId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Administrators cannot suspend their own account.',
          });
        }

        const { status: newStatus, reason } = req.body || {};
        if (!newStatus || !['active', 'suspended'].includes(newStatus)) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Status must be either active or suspended.',
          });
        }

        const user = await userStore.updateUserStatus({
          targetUserId,
          status: newStatus,
          actor: req.user,
          reason: reason?.trim() || `Status updated to ${newStatus} by admin`,
          ipAddress: getClientIp(req),
        });

        if (!user) {
          return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
        }

        return res.status(200).json({
          success: true,
          message: `User account has been ${newStatus === 'suspended' ? 'suspended' : 'activated'}.`,
          user,
        });
      } catch (error) {
        if (error.code === 'LAST_ADMIN_PROTECTION') {
          return res.status(400).json({
            error: 'Bad Request',
            code: 'LAST_ADMIN_PROTECTION',
            message: error.message,
          });
        }
        return next(error);
      }
    },

    listAuditLogs: async (req, res, next) => {
      try {
        const { limit, page } = req.query;
        const result = await userStore.listAuditLogs({
          limit: limit ? parseInt(limit, 10) : 50,
          page: page ? parseInt(page, 10) : 1,
        });

        return res.status(200).json({
          success: true,
          ...result,
        });
      } catch (error) {
        return next(error);
      }
    },

    bootstrapAdmin: async (req, res, next) => {
      try {
        const { email, password, name } = req.body || {};

        if (!email || typeof email !== 'string' || !email.includes('@')) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'A valid email address is required.',
          });
        }

        const user = await userStore.bootstrapFirstAdmin({
          targetEmail: email,
          name: name?.trim() || 'System Administrator',
          password,
          ipAddress: getClientIp(req),
        });

        return res.status(200).json({
          success: true,
          message: 'Initial administrator successfully bootstrapped.',
          user,
        });
      } catch (error) {
        if (error.code === 'BOOTSTRAP_DISABLED') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'BOOTSTRAP_DISABLED',
            message: error.message,
          });
        }
        if (error.code === 'PASSWORD_REQUIRED') {
          return res.status(400).json({
            error: 'Validation Error',
            message: error.message,
          });
        }
        return next(error);
      }
    },
  };
};

export default createAdminController;
