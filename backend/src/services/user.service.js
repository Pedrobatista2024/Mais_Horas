import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import User from "../models/user.js";
import { AppError } from "../utils/AppError.js";
import { generateToken } from "../utils/generateToken.js";

const STUDENT_FIELDS = [
  "fullName", "sex", "phone", "city", "state", "neighborhood",
  "institution", "courseName", "aboutMe", "linkedin", "photoUrl",
];

const ORG_FIELDS = [
  "organizationName", "cnpj", "description", "phone", "website", "address", "instagram",
];

export const userService = {
  async register({ name, email, password, role }) {
    const exists = await User.findByEmail(email);
    if (exists) throw new AppError("Email já cadastrado", 409);

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role });

    return {
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      token: generateToken(user._id),
    };
  },

  async login({ email, password }) {
    const user = await User.findByEmail(email);
    if (!user) throw new AppError("Usuário não encontrado", 400);

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new AppError("Senha incorreta", 400);

    return {
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      token: generateToken(user._id),
    };
  },

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado", 404);
    return user;
  },

  async updateProfile(userId, body, file) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado", 404);

    if (body.name !== undefined) {
      await User.updateBasics(userId, { name: body.name });
    }

    if (user.role === "student") {
      const sp = { ...(user.studentProfile || {}) };
      for (const f of STUDENT_FIELDS) {
        if (body[f] !== undefined) sp[f] = body[f];
      }
      if (body.birthDate !== undefined) {
        if (!body.birthDate) sp.birthDate = null;
        else {
          const d = new Date(body.birthDate);
          if (!Number.isNaN(d.getTime())) sp.birthDate = d.toISOString();
        }
      }
      if (file) sp.photo = replacePhoto(sp.photo, file);
      await User.updateStudentProfile(userId, sp);
    }

    if (user.role === "organization") {
      const op = { ...(user.organizationProfile || {}) };
      for (const f of ORG_FIELDS) {
        if (body[f] !== undefined) op[f] = body[f];
      }
      if (file) op.photo = replacePhoto(op.photo, file);
      await User.updateOrganizationProfile(userId, op);
    }

    return User.findById(userId);
  },

  async getOrgPublic(orgId) {
    const user = await User.findById(orgId);
    if (!user) throw new AppError("ONG não encontrada", 404);
    if (user.role !== "organization") throw new AppError("Usuário não é uma ONG", 400);

    const op = user.organizationProfile || {};
    return {
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
    };
  },

  async getStudentPublic(studentId) {
    const user = await User.findById(studentId);
    if (!user) throw new AppError("Aluno não encontrado", 404);
    if (user.role !== "student") throw new AppError("Usuário não é um aluno", 400);

    const sp = user.studentProfile || {};
    return {
      _id: user._id,
      role: user.role,
      name: sp.fullName || user.name || "",
      email: user.email,
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
      },
    };
  },
};

function replacePhoto(oldPhoto, file) {
  const newPath = file.path.replace(/\\/g, "/");
  if (oldPhoto) {
    const abs = path.resolve(process.cwd(), oldPhoto);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); } catch { /* ignore */ }
    }
  }
  return newPath;
}

export default userService;
