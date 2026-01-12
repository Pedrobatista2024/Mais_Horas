import Participation from "../models/Participation.js";
import Activity from "../models/Activity.js";

// =======================
// 1. Criar Participação
// =======================
export const createParticipation = async (req, res) => {
  try {
    const { activityId } = req.body;

    if (!activityId) {
      return res.status(400).json({ message: "activityId é obrigatório" });
    }

    // evita duplicidade
    const existing = await Participation.findOne({
      activity: activityId,
      user: req.user._id
    });

    if (existing) {
      return res.status(409).json({ message: "Você já está inscrito nesta atividade" });
    }

    const participation = await Participation.create({
      activity: activityId,
      user: req.user._id,
      status: "pending",
      workloadHours: 0
    });

    return res.status(201).json({
      message: "Participação registrada",
      participation
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao registrar participação" });
  }
};

// =======================
// 2. Validar Presença (ONG)
// =======================
export const validatePresence = async (req, res) => {
  try {
    const { participationId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status é obrigatório" });
    }

    const participation = await Participation.findById(participationId);
    if (!participation) {
      return res.status(404).json({ message: "Participação não encontrada" });
    }

    participation.status = status;

    if (status === "present") {
      const activity = await Activity.findById(participation.activity);

      if (!activity || !activity.workloadHours) {
        return res.status(400).json({
          message: "Atividade sem carga horária definida"
        });
      }

      participation.workloadHours = activity.workloadHours;
    }

    participation.validatedBy = req.user._id;

    await participation.save();

    return res.json({
      message: "Presença atualizada!",
      participation
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao validar presença" });
  }
};

// =======================
// 3. Participações do usuário logado
// =======================
export const getUserParticipations = async (req, res) => {
  const userId = req.user._id;

  const participations = await Participation.find({ user: userId })
    .populate("activity", "title date location workloadHours");

  return res.json(participations);
};

// =======================
// 4. Participações de uma atividade
// =======================
export const getActivityParticipations = async (req, res) => {
  const { activityId } = req.params;

  const participations = await Participation.find({ activity: activityId })
    .populate("user", "name email");

  return res.json(participations);
};
