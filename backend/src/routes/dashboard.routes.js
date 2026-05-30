import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { studentDashboard } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/student", authMiddleware, requireRole("student"), studentDashboard);

export default router;
