import Activity from "../models/Activity.js";
import Participation from "../models/Participation.js";

// Criar uma atividade (somente ONGs)
export const createActivity = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      location,
      workloadHours,
      startTime,
      endTime,
      minParticipants,
      maxParticipants
    } = req.body;

    const createdBy = req.user._id;

    const activity = await Activity.create({
      title,
      description,
      date,
      location,
      workloadHours,
      startTime,
      endTime,
      minParticipants,
      maxParticipants,
      createdBy
    });

    return res.status(201).json({
      message: "Atividade criada com sucesso!",
      activity
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar atividade" });
  }
};

// Listar todas atividades (visível para alunos)
export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find().populate("createdBy", "name email");
    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar atividades" });
  }
};

// Listar atividades da ONG logada
export const getMyActivities = async (req, res) => {
  try {
    const orgId = req.user._id;

    const activities = await Activity.find({ createdBy: orgId });

    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar atividades da organização" });
  }
};

// NOVO → Buscar detalhes da atividade
export const getActivityDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id).populate("createdBy", "name email");

    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    return res.json(activity);

  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar detalhes da atividade" });
  }
};

// Inscrição de aluno em uma atividade
export const joinActivity = async (req, res) => {
  try {
    const activityId = req.params.id;
    const userId = req.user._id;

    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    if (activity.participants.length >= activity.maxParticipants) {
      return res.status(400).json({ message: "Atividade já atingiu o número máximo de participantes" });
    }

    if (activity.participants.includes(userId)) {
      return res.status(400).json({ message: "Você já está inscrito nesta atividade" });
    }

    activity.participants.push(userId);
    await activity.save();

    await Participation.create({
      activity: activityId,
      user: userId,
      status: "pending"
    });

    return res.json({ message: "Inscrição realizada com sucesso!" });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao se inscrever" });
  }
};
