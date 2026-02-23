import User from "../models/user.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import fs from "fs";
import path from "path";

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
// UPDATE PROFILE (ALUNO + ONG + FOTO) COM LOGS
// ============================
export const updateProfile = async (req, res) => {
  try {
    console.log("📥 PUT /profile chamado");

    console.log("🧾 req.body recebido:");
    console.log(req.body);

    console.log("📷 req.file recebido:");
    console.log(req.file);

    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // ======================
    // DADOS BÁSICOS
    // ======================
    if (req.body.name !== undefined) {
      user.name = req.body.name;
    }

    // ======================
    // PERFIL DO ALUNO
    // ======================
    if (user.role === "student") {
      if (!user.studentProfile) user.studentProfile = {};

      const sp = user.studentProfile;

      const {
        fullName,
        sex,
        birthDate,
        phone,
        city,
        state,
        neighborhood,
        institution,
        courseName,
        aboutMe,
        linkedin,
        photoUrl,
      } = req.body;

      if (fullName !== undefined) sp.fullName = fullName;
      if (sex !== undefined) sp.sex = sex;

      if (birthDate !== undefined) {
        if (birthDate === "" || birthDate === null) {
          sp.birthDate = undefined;
        } else {
          const d = new Date(birthDate);
          if (!Number.isNaN(d.getTime())) sp.birthDate = d;
        }
      }

      if (phone !== undefined) sp.phone = phone;
      if (city !== undefined) sp.city = city;
      if (state !== undefined) sp.state = state;
      if (neighborhood !== undefined) sp.neighborhood = neighborhood;

      if (institution !== undefined) sp.institution = institution;
      if (courseName !== undefined) sp.courseName = courseName;

      if (aboutMe !== undefined) sp.aboutMe = aboutMe;
      if (linkedin !== undefined) sp.linkedin = linkedin;

      if (photoUrl !== undefined) sp.photoUrl = photoUrl;

      // FOTO DO ALUNO (UPLOAD + REMOVE ANTIGA)
      if (req.file) {
        const newPhotoPath = req.file.path.replace(/\\/g, "/");
        console.log("🆕 Nova foto do aluno detectada:", newPhotoPath);

        if (sp.photo) {
          const oldPhotoAbsolutePath = path.resolve(process.cwd(), sp.photo);

          if (fs.existsSync(oldPhotoAbsolutePath)) {
            fs.unlinkSync(oldPhotoAbsolutePath);
            console.log("🗑️ Foto antiga do aluno removida:", oldPhotoAbsolutePath);
          } else {
            console.log("⚠️ Foto antiga do aluno constava no banco, mas não foi achada no disco");
          }
        }

        sp.photo = newPhotoPath;
      } else {
        console.log("ℹ️ Nenhuma foto nova do aluno enviada. Mantendo a foto atual ou estado vazio.");
      }

      user.studentProfile = sp;
    }

    // ======================
    // PERFIL DA ONG
    // ======================
    if (user.role === "organization") {
      const { organizationName, description, phone, website, address } = req.body;

      if (!user.organizationProfile) {
        user.organizationProfile = {};
      }

      if (organizationName !== undefined) user.organizationProfile.organizationName = organizationName;
      if (description !== undefined) user.organizationProfile.description = description;
      if (phone !== undefined) user.organizationProfile.phone = phone;
      if (website !== undefined) user.organizationProfile.website = website;
      if (address !== undefined) user.organizationProfile.address = address;

      // FOTO (SUBSTITUI E REMOVE A ANTIGA)
      if (req.file) {
        const newPhotoPath = req.file.path.replace(/\\/g, "/");
        console.log("🆕 Nova foto da ONG detectada:", newPhotoPath);

        if (user.organizationProfile.photo) {
          const oldPhotoAbsolutePath = path.resolve(process.cwd(), user.organizationProfile.photo);

          if (fs.existsSync(oldPhotoAbsolutePath)) {
            fs.unlinkSync(oldPhotoAbsolutePath);
            console.log("🗑️ Foto antiga removida com sucesso:", oldPhotoAbsolutePath);
          } else {
            console.log("⚠️ Foto antiga constava no banco, mas não foi achada no disco");
          }
        }

        user.organizationProfile.photo = newPhotoPath;
      } else {
        console.log("ℹ️ Nenhuma foto enviada. Mantendo a foto atual ou estado vazio.");
      }
    }

    // Salva tudo
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

// ============================
// PERFIL PÚBLICO DA ONG (PARA ALUNO VER)
// GET /users/org/:orgId/public
// ============================
export const getOrgPublicProfile = async (req, res) => {
  try {
    const { orgId } = req.params;

    const user = await User.findById(orgId);
    if (!user) return res.status(404).json({ message: "ONG não encontrada" });

    if (user.role !== "organization") {
      return res.status(400).json({ message: "Usuário informado não é uma ONG" });
    }

    const op = user.organizationProfile || {};

    return res.json({
      message: "Perfil público da ONG carregado com sucesso",
      user: {
        _id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        organizationProfile: {
          organizationName: op.organizationName || "",
          description: op.description || "",
          phone: op.phone || "",
          address: op.address || "",
          website: op.website || "",
          instagram: op.instagram || "",
          photo: op.photo || "",
        },
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar perfil público da ONG:", error);
    return res.status(500).json({ error: "Erro ao buscar perfil público da ONG" });
  }
};

// ============================
// PERFIL PÚBLICO DO ALUNO (PARA ONG VER)
// GET /users/student/:studentId/public
// ============================
export const getStudentPublicProfile = async (req, res) => {
  try {
    const { studentId } = req.params;

    const user = await User.findById(studentId);
    if (!user) return res.status(404).json({ message: "Aluno não encontrado" });

    if (user.role !== "student") {
      return res.status(400).json({ message: "Usuário informado não é um aluno" });
    }

    const sp = user.studentProfile || {};

    return res.json({
      message: "Perfil público do aluno carregado com sucesso",
      user: {
        _id: user._id,
        role: user.role,
        name: sp.fullName || user.name || "",
        email: user.email, // ✅ AGORA ENVIA EMAIL
        studentProfile: {
          fullName: sp.fullName || "",
          sex: sp.sex || "",
          birthDate: sp.birthDate || null,
          city: sp.city || "",
          state: sp.state || "",
          neighborhood: sp.neighborhood || "",
          institution: sp.institution || "",
          courseName: sp.courseName || "",
          aboutMe: sp.aboutMe || "",
          linkedin: sp.linkedin || "",
          photoUrl: sp.photoUrl || "",
          photo: sp.photo || "",
          // phone: sp.phone || "",
        },
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar perfil público do aluno:", error);
    return res.status(500).json({ error: "Erro ao buscar perfil público do aluno" });
  }
};