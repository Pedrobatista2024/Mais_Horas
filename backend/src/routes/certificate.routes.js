import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  generateCertificate,
  validateCertificate,
  getMyCertificates,
  downloadCertificatePDF,
  downloadCertificatePDFPublic,
} from "../controllers/certificate.controller.js";
import { idParam, participationIdParam, codeParam } from "../validators/common.validators.js";

const router = express.Router();

// ===== Privadas =====
router.post(
  "/:participationId",
  authMiddleware,
  requireRole("organization"),
  validate({ params: participationIdParam }),
  generateCertificate
);
router.get("/my", authMiddleware, getMyCertificates);
router.get("/:id/pdf", authMiddleware, validate({ params: idParam }), downloadCertificatePDF);

// ===== Públicas (verificação por QR) =====
router.get("/validate/:code", validate({ params: codeParam }), validateCertificate);
router.get("/public/:code/pdf", validate({ params: codeParam }), downloadCertificatePDFPublic);

export default router;
