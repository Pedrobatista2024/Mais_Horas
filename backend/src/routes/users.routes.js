import express from "express";
import { register, login } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// 🔒 Rota protegida
router.get("/profile", authMiddleware, (req, res) => {
  return res.json({
    message: "Perfil carregado com sucesso",
    user: req.user
  });
});

export default router;
