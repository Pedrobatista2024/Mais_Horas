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

    // 1. Busca a atividade básica
    const activity = await Activity.findById(id).populate("createdBy", "name email");

    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    // 2. CORREÇÃO: Busca os participantes na tabela de Participações (onde está salvo corretamente)
    const realParticipations = await Participation.find({ activity: id }).populate("user", "name email");

    // 3. Converte para objeto editável e substitui a lista de participantes
    const activityData = activity.toObject();
    activityData.participants = realParticipations.map(p => p.user);

    return res.json(activityData);

  } catch (error) {
    console.error(error);
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

    // Verifica se já está inscrito (Checagem dupla por segurança)
    if (activity.participants.includes(userId)) {
      return res.status(400).json({ message: "Você já está inscrito" });
    }

    // Atualiza na Atividade
    activity.participants.push(userId);
    await activity.save();

    // Cria a participação na tabela de Participations
    await Participation.create({
      activity: activityId,
      user: userId,
      status: "pending"
    });

    return res.json({ message: "Inscrição realizada com sucesso!" });

  } catch (error) {
    console.error("ERRO AO INSCREVER:", error);
    return res.status(500).json({ error: "Erro ao se inscrever" });
  }
};

// ===========================
// Atualizar Atividade (ONG)
// ===========================
export const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    // CORREÇÃO: Conta quantos alunos existem na tabela de Participações (Fonte da verdade)
    const inscritos = await Participation.countDocuments({ activity: id });
    
    let updates = req.body;

    // 🔒 SE TEM INSCRITOS → SÓ MIN/MAX
    if (inscritos > 0) {
      updates = {
        minParticipants: req.body.minParticipants,
        maxParticipants: req.body.maxParticipants
      };

      if (
        updates.maxParticipants !== undefined &&
        updates.maxParticipants < inscritos
      ) {
        return res.status(400).json({
          message: `O máximo não pode ser menor que ${inscritos}`
        });
      }
    }

    Object.assign(activity, updates);
    await activity.save();

    return res.json({
      message: "Atividade atualizada com sucesso!",
      activity
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao atualizar atividade" });
  }
};

// ===========================
// Excluir Atividade
// ===========================
export const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    await Participation.deleteMany({ activity: id });
    await Activity.findByIdAndDelete(id);

    return res.json({ message: "Atividade excluída com sucesso!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao excluir atividade" });
  }
};