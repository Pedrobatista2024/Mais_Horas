import Certificate from "../models/Certificate.js";
import Participation from "../models/Participation.js";
import { AppError } from "../utils/AppError.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";

export const certificateService = {
  async generateForParticipation(participationId) {
    const participation = await Participation.findById(participationId);
    if (!participation) throw new AppError("Participação não encontrada", 404);
    if (participation.status !== "present") {
      throw new AppError("Presença ainda não validada", 400);
    }

    const existing = await Certificate.findByParticipation(participationId);
    if (existing) throw new AppError("Certificado já emitido", 400);

    return Certificate.create({
      userId: participation.user,
      activityId: participation.activity,
      participationId: participation._id,
      hours: participation.workloadHours,
      verificationCode: generateVerificationCode(),
    });
  },

  listMine(userId) {
    return Certificate.findByUserPopulated(userId);
  },

  async getForPdf(id) {
    const certificate = await Certificate.findByIdPopulated(id);
    if (!certificate) throw new AppError("Certificado não encontrado", 404);
    return certificate;
  },

  async getByCodeForPdf(code) {
    const certificate = await Certificate.findByCodePopulated(code);
    if (!certificate) throw new AppError("Certificado não encontrado", 404);
    return certificate;
  },

  async validateByCode(code) {
    const certificate = await Certificate.findByCodePopulated(code);
    return { valid: !!certificate, certificate: certificate || null };
  },
};

export default certificateService;
