import Certificate from "../models/Certificate.js";
import Participation from "../models/Participation.js";
import Activity from "../models/Activity.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";
import { generateCertificatePDF } from "../utils/generateCertificatePDF.js";

// =======================================================
// GERAR CERTIFICADO (INDIVIDUAL)
// =======================================================
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
    console.error(error);
    return res.status(500).json({ error: "Erro ao gerar certificado" });
  }
};

// =======================================================
// FINALIZAR ATIVIDADE + GERAR CERTIFICADOS
// =======================================================
export const finalizeActivityAndGenerateCertificates = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    if (activity.status === "finished") {
      return res.status(400).json({ message: "Esta atividade já foi finalizada" });
    }

    activity.status = "finished";
    await activity.save();

    const participations = await Participation.find({
      activity: activityId,
      status: "present"
    });

    let generatedCertificates = 0;

    for (const participation of participations) {
      const alreadyExists = await Certificate.findOne({
        participation: participation._id
      });

      if (alreadyExists) continue;

      await Certificate.create({
        user: participation.user,
        activity: activity._id,
        participation: participation._id,
        hours: participation.workloadHours,
        verificationCode: generateVerificationCode()
      });

      generatedCertificates++;
    }

    return res.json({
      message: "Atividade finalizada e certificados gerados com sucesso",
      certificadosGerados: generatedCertificates
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao finalizar atividade e gerar certificados"
    });
  }
};

// =======================================================
// CERTIFICADOS DO USUÁRIO
// =======================================================
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

// =======================================================
// DOWNLOAD PDF (PRIVADO - COM LOGIN)
// =======================================================
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
    res.setHeader("Content-Disposition", "inline; filename=certificado.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao gerar PDF" });
  }
};

// =======================================================
// DOWNLOAD PDF (PÚBLICO - QR CODE)
// =======================================================
export const downloadCertificatePDFPublic = async (req, res) => {
  try {
    const { code } = req.params;

    const certificate = await Certificate.findOne({ verificationCode: code })
      .populate("user", "name")
      .populate({
        path: "activity",
        populate: { path: "createdBy", select: "name" }
      });

    if (!certificate) {
      return res.status(404).send("Certificado não encontrado");
    }

    const pdfBuffer = await generateCertificatePDF(certificate);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=certificado.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).send("Erro ao gerar PDF");
  }
};

// =======================================================
// VALIDAÇÃO API (JSON)
// =======================================================
export const validateCertificate = async (req, res) => {
  const { code } = req.params;

  const certificate = await Certificate.findOne({ verificationCode: code })
    .populate("user", "name email")
    .populate("activity", "title date workloadHours");

  if (!certificate) {
    return res.status(404).json({ valid: false });
  }

  return res.json({ valid: true, certificate });
};

// =======================================================
// PÁGINA PÚBLICA (HTML)
// =======================================================
export const validateCertificatePage = async (req, res) => {
  const { code } = req.params;

  const certificate = await Certificate.findOne({ verificationCode: code })
    .populate("user", "name")
    .populate({
      path: "activity",
      populate: { path: "createdBy", select: "name" }
    });

  if (!certificate) {
    return res.send(`
      <h2 style="text-align:center;">❌ Certificado inválido</h2>
    `);
  }

  return res.send(`
    <h2 style="text-align:center;">✅ Certificado Válido</h2>
    <p><strong>Aluno:</strong> ${certificate.user.name}</p>
    <p><strong>Atividade:</strong> ${certificate.activity.title}</p>
    <p><strong>Horas:</strong> ${certificate.hours}h</p>
    <p><strong>ONG:</strong> ${certificate.activity.createdBy?.name}</p>
  `);
};
