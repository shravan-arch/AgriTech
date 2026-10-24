import mongoose from 'mongoose';

const policyViolationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
    },
    violationType: {
      type: String,
      enum: [
        'unauthorized_data_scraping',
        'spam_listing',
        'fraudulent_claims',
        'terms_of_service_breach',
        'abuse_of_support',
        'unauthorized_api_access',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    actionTaken: {
      type: String,
      enum: ['warning_issued', 'account_flagged', 'account_suspended', 'resolved', 'no_action'],
      default: 'warning_issued',
    },
    actionByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actionDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

const PolicyViolation =
  mongoose.models.PolicyViolation || mongoose.model('PolicyViolation', policyViolationSchema);

export default PolicyViolation;
