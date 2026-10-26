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
      required: function () {
        return !this.googleId;
      },
      minlength: [10, 'Password must be at least 10 characters'],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
    },
    roleChangedAt: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      enum: ['farmer', 'user', 'worker', 'agronomist', 'advisor', 'manager', 'admin'],
      default: 'farmer'
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active'
    },
    roleRequest: {
      requestedRole: {
        type: String,
        enum: ['admin', 'user', 'farmer', null],
        default: null
      },
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none'
      },
      requestedAt: {
        type: Date,
        default: null
      },
      reviewedAt: {
        type: Date,
        default: null
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      reviewNotes: {
        type: String,
        trim: true,
        maxlength: [250, 'Review notes cannot exceed 250 characters'],
        default: ''
      }
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'],
      default: 'en'
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
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone number cannot exceed 30 characters'],
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters'],
      default: '',
    },
    profilePhoto: {
      type: String,
      trim: true,
      default: '',
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Omit password and sensitive reset tokens from responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  return obj;
};

// Prevent model overwrite in development reload
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
