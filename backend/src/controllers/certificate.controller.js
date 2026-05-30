import { asyncHandler } from "../middlewares/asyncHandler.js";
import { certificateService } from "../services/certificate.service.js";
import { generateCertificatePDF } from "../utils/generateCertificatePDF.js";

export const generateCertificate = asyncHandler(async (req, res) => {
  const certificate = await certificateService.generateForParticipation(req.params.participationId);
  res.status(201).json({ message: "Certificado emitido com sucesso", certificate });
});

export const getMyCertificates = asyncHandler(async (req, res) => {
  res.json(await certificateService.listMine(req.user._id));
});

export const downloadCertificatePDF = asyncHandler(async (req, res) => {
  const certificate = await certificateService.getForPdf(req.params.id);
  const pdf = await generateCertificatePDF(certificate);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=certificado.pdf");
  res.send(pdf);
});

export const downloadCertificatePDFPublic = asyncHandler(async (req, res) => {
  const certificate = await certificateService.getByCodeForPdf(req.params.code);
  const pdf = await generateCertificatePDF(certificate);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=certificado.pdf");
  res.send(pdf);
});

export const validateCertificate = asyncHandler(async (req, res) => {
  const result = await certificateService.validateByCode(req.params.code);
  if (!result.valid) return res.status(404).json({ valid: false });
  res.json(result);
});
