import User from "../models/user.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";

// ============================
// REGISTER
// ============================
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "student",
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso",
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("❌ ERRO REGISTER:", error);
    return res.status(500).json({ error: "Erro no servidor" });
  }
};

// ============================
// LOGIN
// ============================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Usuário não encontrado" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Senha incorreta" });
    }

    return res.status(200).json({
      message: "Login realizado",
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("❌ ERRO LOGIN:", error);
    return res.status(500).json({ error: "Erro no servidor" });
  }
};

// ============================
// GET PROFILE (COM LOG)
// ============================
// ============================
// GET PROFILE (ATUALIZADO)
// ============================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    console.log("📤 GET /profile → user retornado:");
    console.log(JSON.stringify(user, null, 2));

    return res.json({
      message: "Perfil carregado com sucesso",
      user,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar perfil:", error);
    return res.status(500).json({ error: "Erro ao buscar perfil" });
  }
};


// ============================
// UPDATE PROFILE (ONG + FOTO) COM LOGS
// ============================
export const updateProfile = async (req, res) => {
  try {
    console.log("📥 PUT /profile chamado");

    console.log("🧾 req.body recebido:");
    console.log(req.body);

    console.log("📷 req.file recebido:");
    console.log(req.file);

    const userId = req.user._id;

    const {
      name,
      organizationName,
      description,
      phone,
      website,
      address,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // ======================
    // DADOS BÁSICOS
    // ======================
    if (name !== undefined) {
      user.name = name;
    }

    // ======================
    // PERFIL DA ONG
    // ======================
    if (user.role === "organization") {
      if (!user.organizationProfile) {
        user.organizationProfile = {};
      }

      if (organizationName !== undefined) {
        user.organizationProfile.organizationName = organizationName;
      }

      if (description !== undefined) {
        user.organizationProfile.description = description;
      }

      if (phone !== undefined) {
        user.organizationProfile.phone = phone;
      }

      if (website !== undefined) {
        user.organizationProfile.website = website;
      }

      if (address !== undefined) {
        user.organizationProfile.address = address;
      }

      // ======================
      // FOTO (NORMALIZANDO CAMINHO)
      // ======================
      if (req.file) {
        const normalizedPath = req.file.path.replace(/\\/g, "/");

        console.log("✅ FOTO SALVA EM:", normalizedPath);

        user.organizationProfile.photo = normalizedPath;
      } else {
        console.log("⚠️ NENHUMA FOTO RECEBIDA");
      }
    }

    await user.save();

    console.log("💾 USUÁRIO SALVO NO BANCO:");
    console.log(JSON.stringify(user, null, 2));

    return res.json({
      message: "Perfil atualizado com sucesso",
      user,
    });
  } catch (error) {
    console.error("❌ ERRO AO ATUALIZAR PERFIL:", error);
    return res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
};
