import Activity from "../models/Activity.js";
import Participation from "../models/Participation.js";
import Certificate from "../models/Certificate.js";
import { AppError } from "../utils/AppError.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";
import { parseDateOnlyToUTCNoon, isPastDate } from "../utils/date.js";

function capitalize(value) {
  if (!value || typeof value !== "string") return value;
  const t = value.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

async function assertOwner(activityId, userId) {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new AppError("Atividade não encontrada", 404);
  if (activity.createdBy !== userId) throw new AppError("Acesso negado", 403);
  return activity;
}

export const activityService = {
  async create(userId, data) {
    const date = parseDateOnlyToUTCNoon(data.date);
    if (!date) throw new AppError("Data inválida", 400);
    if (isPastDate(date)) throw new AppError("A data da atividade não pode ser no passado", 400);

    return Activity.create({
      title: capitalize(data.title),
      description: capitalize(data.description),
      location: capitalize(data.location),
      date,
      startTime: data.startTime,
      endTime: data.endTime,
      workloadHours: data.workloadHours,
      minParticipants: data.minParticipants,
      maxParticipants: data.maxParticipants,
      createdBy: userId,
      status: "active",
    });
  },

  listAll() {
    return Activity.findAllWithCreator();
  },

  listByOrg(userId) {
    return Activity.findByCreator(userId);
  },

  async getDetails(id) {
    const activity = await Activity.findByIdWithCreator(id);
    if (!activity) throw new AppError("Atividade não encontrada", 404);
    const participants = await Participation.findByActivityWithUser(id);
    return { ...activity, participants };
  },

  async update(id, userId, body) {
    await assertOwner(id, userId);
    const inscritos = await Activity.countParticipants(id);

    if (body.maxParticipants !== undefined && body.maxParticipants < inscritos) {
      throw new AppError(
        `O número máximo não pode ser menor que o total de inscritos (${inscritos})`,
        400
      );
    }

    let patch = {};
    if (inscritos > 0) {
      // Com inscritos: só limites podem mudar
      if (body.minParticipants !== undefined) patch.minParticipants = body.minParticipants;
      if (body.maxParticipants !== undefined) patch.maxParticipants = body.maxParticipants;
    } else {
      const fields = ["startTime", "endTime", "workloadHours", "minParticipants", "maxParticipants"];
      for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];
      if (body.title !== undefined) patch.title = capitalize(body.title);
      if (body.description !== undefined) patch.description = capitalize(body.description);
      if (body.location !== undefined) patch.location = capitalize(body.location);
      if (body.date !== undefined) {
        const date = parseDateOnlyToUTCNoon(body.date);
        if (!date) throw new AppError("Data inválida", 400);
        if (isPastDate(date)) throw new AppError("A data da atividade não pode ser no passado", 400);
        patch.date = date;
      }
    }

    return Activity.update(id, patch);
  },

  async updateAttendance(id, userId, { userId: studentId, status }) {
    await assertOwner(id, userId);
    const participation = await Participation.findByActivityAndUser(id, studentId);
    if (!participation) throw new AppError("Participação não encontrada", 404);

    const activity = await Activity.findById(id);
    const workloadHours = status === "present" ? activity.workloadHours : 0;
    await Participation.updateStatus(participation._id, { status, validatedBy: userId, workloadHours });
  },

  async join(activityId, userId) {
    const activity = await Activity.findById(activityId);
    if (!activity || activity.status !== "active") {
      throw new AppError("Atividade lotada ou encerrada", 400);
    }

    const already = await Participation.findByActivityAndUser(activityId, userId);
    if (already) throw new AppError("Você já está inscrito", 400);

    const count = await Activity.countParticipants(activityId);
    if (count >= activity.maxParticipants) throw new AppError("Atividade lotada", 400);

    return Participation.create({ activityId, userId, status: "pending" });
  },

  async finish(id, userId) {
    const activity = await assertOwner(id, userId);

    if (!activity.workloadHours || activity.workloadHours <= 0) {
      throw new AppError("Carga horária inválida. Verifique a atividade antes de finalizar", 400);
    }
    if (activity.status !== "active") {
      throw new AppError("Atividade já finalizada ou cancelada", 400);
    }

    const pendentes = await Participation.countPendingByActivity(id);
    if (pendentes > 0) {
      throw new AppError(
        "Finalize a presença de todos os participantes antes de encerrar a atividade",
        400
      );
    }

    const presentes = await Participation.findPresentByActivity(id);
    let certificadosGerados = 0;
    for (const p of presentes) {
      const exists = await Certificate.findByParticipation(p._id);
      if (!exists) {
        await Certificate.create({
          userId: p.user,
          activityId: activity._id,
          participationId: p._id,
          hours: activity.workloadHours,
          verificationCode: generateVerificationCode(),
        });
        certificadosGerados++;
      }
    }

    await Activity.setStatus(id, "finished");
    return { certificadosGerados };
  },

  async remove(id, userId) {
    await assertOwner(id, userId);
    await Participation.deleteByActivity(id);
    await Activity.delete(id);
  },
};

export default activityService;
