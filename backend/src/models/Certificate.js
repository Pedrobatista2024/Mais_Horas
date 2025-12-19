import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true
    },

    participation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participation",
      required: true
    },

    hours: {
      type: Number,
      required: true
    },

    verificationCode: {
      type: String,
      required: true,
      unique: true
    },

    issuedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default mongoose.model("Certificate", certificateSchema);
