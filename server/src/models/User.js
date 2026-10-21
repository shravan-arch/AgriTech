import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [10, 'Password must be at least 10 characters'],
    },
    role: {
      type: String,
      enum: ['farmer', 'agronomist', 'admin'],
      default: 'farmer'
    },
    farmName: {
      type: String,
      trim: true,
      maxlength: [100, 'Farm name cannot exceed 100 characters']
    },
    farmSizeHectares: {
      type: Number,
      min: [0.01, 'Farm size must be greater than zero']
    },
    primaryCrops: {
      type: [String],
      default: []
    },
    location: {
      region: { type: String, trim: true },
      country: { type: String, trim: true }
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Omit password from responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Prevent model overwrite in development reload
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
