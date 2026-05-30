import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  validatePresence,
  getUserParticipations,
  getActivityParticipations,
  createParticipation,
} from "../controllers/participation.controller.js";
import {
  createParticipationSchema,
  validatePresenceSchema,
} from "../validators/participation.validators.js";
import { participationIdParam, activityIdParam } from "../validators/common.validators.js";

const router = express.Router();

// ONG valida presença
router.put(
  "/:participationId/validate",
  authMiddleware,
  requireRole("organization"),
  validate({ params: participationIdParam, body: validatePresenceSchema }),
  validatePresence
);

// Minhas participações (aluno)
router.get("/my", authMiddleware, getUserParticipations);

// Participações de uma atividade
router.get(
  "/activity/:activityId",
  authMiddleware,
  validate({ params: activityIdParam }),
  getActivityParticipations
);

// Aluno se inscreve
router.post(
  "/",
  authMiddleware,
  requireRole("student"),
  validate({ body: createParticipationSchema }),
  createParticipation
);

export default router;
