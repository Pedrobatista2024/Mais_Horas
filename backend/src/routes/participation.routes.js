import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validatePresence, getUserParticipations, getActivityParticipations } from "../controllers/participation.controller.js";

const router = express.Router();

// Validar presença (ONG)
router.put("/:participationId/validate", authMiddleware, validatePresence);

// Listar presenças do usuário logado
router.get("/my", authMiddleware, getUserParticipations);

// Listar presenças de uma atividade
router.get("/activity/:activityId", authMiddleware, getActivityParticipations);

export default router;
