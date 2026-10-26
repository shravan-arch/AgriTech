import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'ROLE_CHANGE',
        'ROLE_REQUEST_APPROVED',
        'ROLE_REQUEST_REJECTED',
        'USER_SUSPENDED',
        'USER_ACTIVATED',
        'ADMIN_BOOTSTRAP',
        'ADMIN_PROFILE_UPDATE',
        'ADMIN_FARM_UPDATE',
        'SUPPORT_EMAIL_VERIFIED',
        'SUPPORT_PASSWORD_RESET',
        'AUTH_FAILURE',
        'PLATFORM_SETTINGS_UPDATE',
        'SYSTEM_ANNOUNCEMENT',
        'ACCOUNT_DELETED',
      ],
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorEmail: {
      type: String,
      default: 'system',
    },
    actorName: {
      type: String,
      default: 'System',
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetUserEmail: {
      type: String,
      default: '',
    },
    targetUserName: {
      type: String,
      default: '',
    },
    previousRole: {
      type: String,
      default: null,
    },
    newRole: {
      type: String,
      default: null,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetUserId: 1 });
auditLogSchema.index({ actorId: 1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
