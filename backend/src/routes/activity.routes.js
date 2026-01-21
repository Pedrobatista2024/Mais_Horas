import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createActivity,
  getAllActivities,
  joinActivity,
  getMyActivities,
  getActivityDetails
} from "../controllers/activity.controller.js";

const router = express.Router();

// Criar atividade
router.post("/", authMiddleware, createActivity);

// Listar todas
router.get("/", getAllActivities);

// Listar atividades da ONG
router.get("/my", authMiddleware, getMyActivities);

// NOVO → detalhes da atividade
router.get("/:id", authMiddleware, getActivityDetails);

// Inscrever aluno
router.post("/:id/join", authMiddleware, joinActivity);

export default router;
