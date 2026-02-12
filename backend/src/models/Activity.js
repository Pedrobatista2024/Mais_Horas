import mongoose from "mongoose";

function capitalizeFirstLetter(value) {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const activitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      maxlength: [40, "Título pode ter no máximo 40 caracteres"],
      set: capitalizeFirstLetter
    },

    description: {
      type: String,
      maxlength: [1500, "Descrição pode ter no máximo 1500 caracteres"],
      set: capitalizeFirstLetter
    },

    date: {
      type: Date
    },

    startTime: {
      type: String
    },

    endTime: {
      type: String
    },

    location: {
      type: String,
      maxlength: [50, "Local pode ter no máximo 50 caracteres"],
      set: capitalizeFirstLetter
    },

    workloadHours: {
      type: Number,
      min: [1, "Carga horária deve ser maior que 0"]
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        attendance: {
          type: String,
          enum: ["pending", "present", "absent"],
          default: "pending"
        }
      }
    ],

    minParticipants: {
      type: Number,
      min: [1, "Mínimo de participantes deve ser pelo menos 1"],
      default: 1
    },

    maxParticipants: {
      type: Number,
      default: 20
    },

    status: {
      type: String,
      enum: ["active", "finished", "cancelled"],
      default: "active"
    }
  },
  { timestamps: true }
);

//
// ✅ Validação segura para CREATE e UPDATE
//
activitySchema.pre("save", function (next) {
  if (this.maxParticipants < this.minParticipants) {
    return next(
      new Error("Máximo de participantes não pode ser menor que o mínimo")
    );
  }

  // valida obrigatórios APENAS na criação
  if (this.isNew) {
    const requiredFields = [
      "title",
      "description",
      "date",
      "startTime",
      "endTime",
      "location",
      "workloadHours"
    ];

    for (const field of requiredFields) {
      if (!this[field]) {
        return next(new Error(`Campo obrigatório ausente: ${field}`));
      }
    }
  }

  next();
});

export default mongoose.model("Activity", activitySchema);
