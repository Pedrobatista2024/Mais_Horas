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
