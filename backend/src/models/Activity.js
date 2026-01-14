import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // ex: "14:00"
    endTime: { type: String, required: true }, // ex: "18:00"
    location: { type: String, required: true },
    workloadHours: { type: Number, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    minParticipants: { type: Number, default: 1 },
    maxParticipants: { type: Number, default: 20 },

    status: {
      type: String,
      enum: ["active", "finished", "cancelled"],
      default: "active",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Activity", activitySchema);
