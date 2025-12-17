import Activity from "../models/Activity.js";
import Participation from "../models/Participation.js";

// Criar uma atividade (somente ONGs)
export const createActivity = async (req, res) => {
  try {
    const { title, description, date, location, workloadHours } = req.body;

    const createdBy = req.user._id;

    const activity = await Activity.create({
      title,
      description,
      date,
      location,
      workloadHours,
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

// Listar todas atividades
export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find().populate("createdBy", "name email");
    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar atividades" });
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

    // verificar se já está inscrito
    if (activity.participants.includes(userId)) {
      return res.status(400).json({ message: "Você já está inscrito nesta atividade" });
    }

    // adicionar usuário à lista de participantes
    activity.participants.push(userId);
    await activity.save();

    // CRIAR registro de participação (PONTO QUE FALTAVA)
    await Participation.create({
      activity: activityId,
      user: userId,
      status: "pending" // aguardando validação
    });

    return res.json({ message: "Inscrição realizada com sucesso!" });

  } catch (error) {
    return res.status(500).json({ error: "Erro ao se inscrever" });
  }
};
