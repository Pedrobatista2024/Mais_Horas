import Participation from "../models/Participation.js";
import Activity from "../models/Activity.js";

// ONG valida a presença
export const validatePresence = async (req, res) => {
  try {
    const { participationId } = req.params;
    const { status } = req.body;

    const participation = await Participation.findById(participationId);
    if (!participation) {
      return res.status(404).json({ message: "Participação não encontrada" });
    }

    // Somente ONGs deveriam validar (avançaremos isso depois)
    participation.status = status;
    
    // Se presente → registrar horas automaticamente
    if (status === "present") {
      const activity = await Activity.findById(participation.activity);
      participation.workloadHours = activity.workloadHours;
    }

    participation.validatedBy = req.user._id;

    await participation.save();

    return res.json({ message: "Presença atualizada!", participation });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao validar presença" });
  }
};

// Todos os registros de um usuário
export const getUserParticipations = async (req, res) => {
  const userId = req.user._id;

  const participations = await Participation.find({ user: userId })
    .populate("activity", "title date location");

  return res.json(participations);
};

// Lista presenças de uma atividade (ONG)
export const getActivityParticipations = async (req, res) => {
  const { activityId } = req.params;

  const participations = await Participation.find({ activity: activityId })
    .populate("user", "name email");

  return res.json(participations);
};
