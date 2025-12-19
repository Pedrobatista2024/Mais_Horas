import Participation from "../models/Participation.js";
import Activity from "../models/Activity.js";

// ONG valida presença
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

    // Atualizar status explicitamente
    participation.status = status;

    // Se presença confirmada, aplicar carga horária
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

// Participações do usuário
export const getUserParticipations = async (req, res) => {
  const userId = req.user._id;

  const participations = await Participation.find({ user: userId })
    .populate("activity", "title date location workloadHours");

  return res.json(participations);
};

// Participações de uma atividade
export const getActivityParticipations = async (req, res) => {
  const { activityId } = req.params;

  const participations = await Participation.find({ activity: activityId })
    .populate("user", "name email");

  return res.json(participations);
};
