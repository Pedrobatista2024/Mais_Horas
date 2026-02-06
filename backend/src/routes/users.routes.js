import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../config/upload.js";

const router = express.Router();

// ============================
// ROTAS PÚBLICAS
// ============================
router.post("/register", register);
router.post("/login", login);

// ============================
// ROTAS PROTEGIDAS
// ============================

// Buscar perfil do usuário (SEMPRE DO BANCO)
router.get("/profile", authMiddleware, getProfile);

// Atualizar perfil da ONG (COM FOTO)
router.put(
  "/profile",
  authMiddleware,
  upload.single("photo"), // 🔥 MESMO NOME DO FRONTEND
  updateProfile
);

export default router;
