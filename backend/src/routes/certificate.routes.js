import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  generateCertificate,
  validateCertificate,
  validateCertificatePage,
  getMyCertificates,
  downloadCertificatePDF
} from "../controllers/certificate.controller.js";

const router = express.Router();

// ONG emite certificado
router.post("/:participationId", authMiddleware, generateCertificate);

// Aluno vê seus certificados
router.get("/my", authMiddleware, getMyCertificates);

// Validação pública
router.get("/validate/:code", validateCertificate);

// rota do pdf
router.get("/:id/pdf", authMiddleware, downloadCertificatePDF);

// HTML (para pessoas / QR Code)
router.get("/verify/:code", validateCertificatePage);

export default router;
