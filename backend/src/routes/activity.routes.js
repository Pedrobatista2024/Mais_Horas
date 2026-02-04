import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createActivity,
  getAllActivities,
  joinActivity,
  getMyActivities,
  getActivityDetails,
  updateActivity,
  deleteActivity,
  finishActivity // ✅ NOVO IMPORT
} from "../controllers/activity.controller.js";

const router = express.Router();

// Criar atividade
router.post("/", authMiddleware, createActivity);

// Listar todas
router.get("/", getAllActivities);

// Listar atividades da ONG
router.get("/my", authMiddleware, getMyActivities);

// Detalhes da atividade
router.get("/:id", authMiddleware, getActivityDetails);

// Inscrever aluno
router.post("/:id/join", authMiddleware, joinActivity);

// Atualizar atividade
router.put("/:id", authMiddleware, updateActivity);

// 🆕 FINALIZAR ATIVIDADE
router.post("/:id/finish", authMiddleware, finishActivity);

// Excluir atividade
router.delete("/:id", authMiddleware, deleteActivity);

export default router;
