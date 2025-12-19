import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { studentDashboard } from "../controllers/dashboard.controller.js";

const router = express.Router();

// Dashboard do aluno
router.get("/student", authMiddleware, studentDashboard);

export default router;
