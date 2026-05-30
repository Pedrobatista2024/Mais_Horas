import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createActivity,
  getAllActivities,
  joinActivity,
  getMyActivities,
  getActivityDetails,
  updateActivity,
  deleteActivity,
  finishActivity,
  updateAttendance,
} from "../controllers/activity.controller.js";
import {
  createActivitySchema,
  updateActivitySchema,
  attendanceSchema,
} from "../validators/activity.validators.js";
import { idParam } from "../validators/common.validators.js";

const router = express.Router();

// Pública
router.get("/", getAllActivities);

// ONG
router.post(
  "/",
  authMiddleware,
  requireRole("organization"),
  validate({ body: createActivitySchema }),
  createActivity
);
router.get("/my", authMiddleware, requireRole("organization"), getMyActivities);

// Detalhes (qualquer logado)
router.get("/:id", authMiddleware, validate({ params: idParam }), getActivityDetails);

// Aluno
router.post(
  "/:id/join",
  authMiddleware,
  requireRole("student"),
  validate({ params: idParam }),
  joinActivity
);

// ONG — gestão da própria atividade
router.put(
  "/:id",
  authMiddleware,
  requireRole("organization"),
  validate({ params: idParam, body: updateActivitySchema }),
  updateActivity
);
router.patch(
  "/:id/attendance",
  authMiddleware,
  requireRole("organization"),
  validate({ params: idParam, body: attendanceSchema }),
  updateAttendance
);
router.post(
  "/:id/finish",
  authMiddleware,
  requireRole("organization"),
  validate({ params: idParam }),
  finishActivity
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("organization"),
  validate({ params: idParam }),
  deleteActivity
);

export default router;
