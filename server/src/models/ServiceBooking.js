import mongoose from 'mongoose';

const serviceBookingSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
      enum: [
        'Drone Precision Spraying',
        'Soil Testing & Nutrient Analysis',
        'Harvester & Combine Rental',
        'Agronomist Field Consultation',
        'Laser Land Leveling',
        'Solar Water Pump Inspection',
      ],
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    farmerName: {
      type: String,
      required: true,
      trim: true,
    },
    farmerEmail: {
      type: String,
      required: true,
      trim: true,
    },
    farmName: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    technicianAssigned: {
      type: String,
      trim: true,
      default: 'Unassigned',
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    deliveryNotes: {
      type: String,
      trim: true,
      default: '',
    },
    feeINR: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

const ServiceBooking =
  mongoose.models.ServiceBooking || mongoose.model('ServiceBooking', serviceBookingSchema);

export default ServiceBooking;
