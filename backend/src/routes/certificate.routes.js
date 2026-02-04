import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  generateCertificate,
  validateCertificate,
  validateCertificatePage,
  getMyCertificates,
  downloadCertificatePDF,
  downloadCertificatePDFPublic
} from "../controllers/certificate.controller.js";

const router = express.Router();

// ================= PRIVADAS =================

// Emitir certificado (ONG)
router.post("/:participationId", authMiddleware, generateCertificate);

// Meus certificados (Aluno)
router.get("/my", authMiddleware, getMyCertificates);

// PDF privado (logado)
router.get("/:id/pdf", authMiddleware, downloadCertificatePDF);

// ================= PÚBLICAS =================

// Validação JSON
router.get("/validate/:code", validateCertificate);

// Página HTML
router.get("/verify/:code", validateCertificatePage);

// PDF público (QR Code)
router.get("/public/:code/pdf", downloadCertificatePDFPublic);

export default router;
