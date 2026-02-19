import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "organization"],
      default: "student",
    },

    // ===============================
    // 🔹 PERFIL DO ALUNO
    // ===============================
    studentProfile: {
      fullName: { type: String, default: "" },
      sex: { type: String, default: "" }, // male | female | other | prefer_not_say
      birthDate: { type: Date },

      phone: { type: String, default: "" },

      city: { type: String, default: "" },
      state: { type: String, default: "" },
      neighborhood: { type: String, default: "" },

      institution: { type: String, default: "" },
      courseName: { type: String, default: "" },

      aboutMe: { type: String, default: "" },

      linkedin: { type: String, default: "" },

      // foto via upload (caminho salvo)
      photo: { type: String, default: "" },

      // foto via URL (opcional)
      photoUrl: { type: String, default: "" },
    },

    // ===============================
    // 🔹 PERFIL DA ORGANIZAÇÃO (ONG)
    // ===============================
    organizationProfile: {
      organizationName: {
        type: String,
      },

      cnpj: {
        type: String,
      },

      description: {
        type: String,
      },

      phone: {
        type: String,
      },

      address: {
        type: String,
      },

      website: {
        type: String,
      },

      instagram: {
        type: String,
      },

      // ✅ FOTO / LOGO DA ONG (CAMPO CORRETO)
      photo: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
