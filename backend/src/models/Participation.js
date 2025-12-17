import mongoose from "mongoose";

const participationSchema = new mongoose.Schema(
  {
    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "present", "absent"],
      default: "pending"
    },

    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // normalmente a ONG ou gestor
      default: null
    },

    workloadHours: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("Participation", participationSchema);
