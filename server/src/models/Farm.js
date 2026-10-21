import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Farm name is required'],
      trim: true,
      minlength: [1, 'Farm name is required'],
      maxlength: [100, 'Farm name cannot exceed 100 characters'],
    },
    location: {
      region: { type: String, trim: true, maxlength: 100 },
      country: { type: String, trim: true, maxlength: 100 },
      city: { type: String, trim: true, maxlength: 100 },
    },
  },
  { timestamps: true }
);

farmSchema.index({ ownerId: 1, createdAt: -1 });

const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema);

export default Farm;
