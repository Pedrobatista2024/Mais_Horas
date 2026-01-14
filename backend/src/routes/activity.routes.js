import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createActivity, getAllActivities, joinActivity } from "../controllers/activity.controller.js";
import { getMyActivities } from "../controllers/activity.controller.js";

const router = express.Router();

// Criar atividade (precisa estar logado)
router.post("/", authMiddleware, createActivity);

// Listar atividades
router.get("/", getAllActivities);

// Inscrever aluno
router.post("/:id/join", authMiddleware, joinActivity);

// Listar atividades da ONG logada
router.get("/my", authMiddleware, getMyActivities);

export default router;
