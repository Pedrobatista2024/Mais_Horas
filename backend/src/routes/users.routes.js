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
import { validate } from "../middlewares/validate.middleware.js";
import { upload } from "../config/upload.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  orgIdParam,
  studentIdParam,
} from "../validators/user.validators.js";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Públicas (com rate limit anti força-bruta)
router.post("/register", authLimiter, validate({ body: registerSchema }), register);
router.post("/login", authLimiter, validate({ body: loginSchema }), login);

// Perfis públicos (logado, evita scraping)
router.get("/org/:orgId/public", authMiddleware, validate({ params: orgIdParam }), getOrgPublicProfile);
router.get(
  "/student/:studentId/public",
  authMiddleware,
  validate({ params: studentIdParam }),
  getStudentPublicProfile
);

// Perfil do próprio usuário
router.get("/profile", authMiddleware, getProfile);
router.put(
  "/profile",
  authMiddleware,
  upload.single("photo"),
  validate({ body: updateProfileSchema }),
  updateProfile
);

export default router;
