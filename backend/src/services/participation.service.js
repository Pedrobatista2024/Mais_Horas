import Participation from "../models/Participation.js";
import Activity from "../models/Activity.js";
import { AppError } from "../utils/AppError.js";

export const participationService = {
  async create(userId, activityId) {
    const existing = await Participation.findByActivityAndUser(activityId, userId);
    if (existing) throw new AppError("Você já está inscrito nesta atividade", 409);
    return Participation.create({ activityId, userId, status: "pending", workloadHours: 0 });
  },

  async validatePresence(participationId, validatorId, status) {
    const participation = await Participation.findById(participationId);
    if (!participation) throw new AppError("Participação não encontrada", 404);

    let workloadHours = participation.workloadHours;
    if (status === "present") {
      const activity = await Activity.findById(participation.activity);
      if (!activity || !activity.workloadHours) {
        throw new AppError("Atividade sem carga horária definida", 400);
      }
      workloadHours = activity.workloadHours;
    } else {
      workloadHours = 0;
    }

    return Participation.updateStatus(participationId, {
      status,
      validatedBy: validatorId,
      workloadHours,
    });
  },

  listMine(userId) {
    return Participation.findByUserWithActivity(userId);
  },

  listByActivity(activityId) {
    return Participation.findByActivityWithUser(activityId);
  },
};

export default participationService;
