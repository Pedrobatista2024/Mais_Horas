import Certificate from "../models/Certificate.js";
import Participation from "../models/Participation.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";
import { generateCertificatePDF } from "../utils/generateCertificatePDF.js";

// Gerar certificado (após presença validada)
export const generateCertificate = async (req, res) => {
  try {
    const { participationId } = req.params;

    const participation = await Participation.findById(participationId)
      .populate("activity")
      .populate("user");

    if (!participation) {
      return res.status(404).json({ message: "Participação não encontrada" });
    }

    if (participation.status !== "present") {
      return res.status(400).json({ message: "Presença ainda não validada" });
    }

    // Evitar certificado duplicado
    const existing = await Certificate.findOne({ participation: participationId });
    if (existing) {
      return res.status(400).json({ message: "Certificado já emitido" });
    }

    const certificate = await Certificate.create({
      user: participation.user._id,
      activity: participation.activity._id,
      participation: participation._id,
      hours: participation.workloadHours,
      verificationCode: generateVerificationCode()
    });

    return res.status(201).json({
      message: "Certificado emitido com sucesso",
      certificate
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao gerar certificado" });
  }
};

// Validar certificado (rota pública)
export const validateCertificate = async (req, res) => {
  const { code } = req.params;

  const certificate = await Certificate.findOne({ verificationCode: code })
    .populate("user", "name email")
    .populate("activity", "title date workloadHours");

  if (!certificate) {
    return res.status(404).json({ valid: false });
  }

  return res.json({
    valid: true,
    certificate
  });
};

export const getMyCertificates = async (req, res) => {
  try {
    const userId = req.user._id;

    const certificates = await Certificate.find({ user: userId })
      .populate("activity", "title date location")
      .sort({ createdAt: -1 });

    return res.json(certificates);

  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar certificados" });
  }
};

export const downloadCertificatePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const certificate = await Certificate.findById(id)
      .populate("user", "name")
      .populate({
        path: "activity",
        populate: { path: "createdBy", select: "name" }
      });

    if (!certificate) {
      return res.status(404).json({ message: "Certificado não encontrado" });
    }

    const pdfBuffer = await generateCertificatePDF(certificate);

res.setHeader("Content-Type", "application/pdf");
res.setHeader(
  "Content-Disposition",
  "inline; filename=certificado.pdf"
);
res.send(pdfBuffer);

  } catch (error) {
    return res.status(500).json({ error: "Erro ao gerar PDF" });
  }
};