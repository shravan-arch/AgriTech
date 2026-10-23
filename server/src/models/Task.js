import mongoose from 'mongoose';

export const TASK_TYPES = [
  'planting',
  'irrigation',
  'fertilizer',
  'pest_observation',
  'treatment',
  'inspection',
  'labor',
  'harvesting',
  'general',
];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

const taskSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    cropCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CropCycle',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    type: {
      type: String,
      required: [true, 'Task type is required'],
      enum: {
        values: TASK_TYPES,
        message: 'Invalid task type',
      },
      default: 'general',
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: TASK_PRIORITIES,
        message: 'Invalid task priority',
      },
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: 'Invalid task status',
      },
      default: 'pending',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    assignee: {
      type: String,
      trim: true,
      maxlength: [100, 'Assignee cannot exceed 100 characters'],
    },
    assignedWorkerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    completionNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Completion notes cannot exceed 1000 characters'],
    },
    photoIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FieldPhoto',
      },
    ],
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

taskSchema.index({ ownerId: 1, status: 1, dueDate: 1 });
taskSchema.index({ ownerId: 1, farmId: 1, dueDate: 1 });
taskSchema.index({ ownerId: 1, fieldId: 1, dueDate: 1 });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

export default Task;
