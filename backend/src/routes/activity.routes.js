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
  finishActivity,
  updateAttendance // 🆕 NOVO IMPORT
} from "../controllers/activity.controller.js";

const router = express.Router();

// ===========================
// Criar atividade (ONG)
// ===========================
router.post("/", authMiddleware, createActivity);

// ===========================
// Listar todas (alunos)
// ===========================
router.get("/", getAllActivities);

// ===========================
// Listar atividades da ONG
// ===========================
router.get("/my", authMiddleware, getMyActivities);

// ===========================
// Detalhes da atividade
// ===========================
router.get("/:id", authMiddleware, getActivityDetails);

// ===========================
// Inscrição do aluno
// ===========================
router.post("/:id/join", authMiddleware, joinActivity);

// ===========================
// Atualizar atividade
// ===========================
router.put("/:id", authMiddleware, updateActivity);

// ===========================
// 🆕 Atualizar presença dos participantes (ONG)
// ===========================
router.patch("/:id/attendance", authMiddleware, updateAttendance);

// ===========================
// Finalizar atividade (com regra de presença)
// ===========================
router.post("/:id/finish", authMiddleware, finishActivity);

// ===========================
// Excluir atividade
// ===========================
router.delete("/:id", authMiddleware, deleteActivity);

export default router;
