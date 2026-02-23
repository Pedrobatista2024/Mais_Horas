import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  getOrgPublicProfile,
  getStudentPublicProfile,
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
// PERFIS PÚBLICOS (VISUALIZAÇÃO)
// ✅ Recomendado manter protegido (authMiddleware) pra evitar scraping.
// Se quiser público total, é só remover o authMiddleware.
// ============================
router.get("/org/:orgId/public", authMiddleware, getOrgPublicProfile);
router.get("/student/:studentId/public", authMiddleware, getStudentPublicProfile);

// ============================
// ROTAS PROTEGIDAS
// ============================

// Buscar perfil do usuário (SEMPRE DO BANCO)
router.get("/profile", authMiddleware, getProfile);

// Atualizar perfil (ALUNO ou ONG) (COM FOTO)
router.put(
  "/profile",
  authMiddleware,
  upload.single("photo"), // 🔥 MESMO NOME DO FRONTEND
  updateProfile
);

export default router;