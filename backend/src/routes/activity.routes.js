import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createActivity, getAllActivities, joinActivity } from "../controllers/activity.controller.js";

const router = express.Router();

// Criar atividade (precisa estar logado)
router.post("/", authMiddleware, createActivity);

// Listar atividades
router.get("/", getAllActivities);

// Inscrever aluno
router.post("/:id/join", authMiddleware, joinActivity);

export default router;
