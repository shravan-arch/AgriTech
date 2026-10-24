import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_due',
  'task_overdue',
  'weather_alert',
  'inventory_low',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'system',
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    link: {
      type: String,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
    },
    sensorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sensor',
      index: true,
    },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      index: true,
    },
    fieldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      index: true,
    },
    isSimulated: {
      type: Boolean,
      default: false,
      index: true,
    },
    alertKey: {
      type: String,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ ownerId: 1, alertKey: 1, createdAt: -1 });
notificationSchema.index({ ownerId: 1, acknowledged: 1, createdAt: -1 });


notificationSchema.index({ ownerId: 1, read: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
