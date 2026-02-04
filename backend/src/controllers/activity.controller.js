import Activity from "../models/Activity.js";
import Participation from "../models/Participation.js";
import Certificate from "../models/Certificate.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";

// 👇 LOG GLOBAL
console.log("📂 [CARREGAMENTO] activity.controller.js carregado");

// ===========================
// Criar atividade (ONG)
// ===========================
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
      createdBy,
      status: "active"
    });

    return res.status(201).json({
      message: "Atividade criada com sucesso!",
      activity
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar atividade" });
  }
};

// ===========================
// Listar todas (alunos)
// ===========================
export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate("createdBy", "name email");

    return res.json(activities);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar atividades" });
  }
};

// ===========================
// Listar atividades da ONG
// ===========================
export const getMyActivities = async (req, res) => {
  try {
    const orgId = req.user._id;
    const activities = await Activity.find({ createdBy: orgId });
    return res.json(activities);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar atividades da ONG" });
  }
};

// ===========================
// Detalhes da atividade
// ===========================
export const getActivityDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id)
      .populate("createdBy", "name email");

    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    const participations = await Participation.find({ activity: id })
      .populate("user", "name email");

    const activityData = activity.toObject();
    activityData.participants = participations.map(p => p.user);

    return res.json(activityData);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar detalhes" });
  }
};

// ===========================
// Inscrição (ATÔMICA)
// ===========================
export const joinActivity = async (req, res) => {
  try {
    const activityId = req.params.id;
    const userId = req.user._id;

    const alreadyJoined = await Participation.findOne({
      activity: activityId,
      user: userId
    });

    if (alreadyJoined) {
      return res.status(400).json({ message: "Você já está inscrito" });
    }

    const updatedActivity = await Activity.findOneAndUpdate(
      {
        _id: activityId,
        status: "active",
        $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] }
      },
      { $push: { participants: userId } },
      { new: true }
    );

    if (!updatedActivity) {
      return res.status(400).json({
        message: "Atividade lotada ou encerrada"
      });
    }

    await Participation.create({
      activity: activityId,
      user: userId,
      status: "pending"
    });

    return res.json({ message: "Inscrição realizada com sucesso!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao se inscrever" });
  }
};

// ===========================
// Atualizar atividade
// ===========================
export const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    if (!activity.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const inscritos = activity.participants.length;
    let updates = req.body;

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
      message: "Atividade atualizada",
      activity
    });
  } catch {
    return res.status(500).json({ error: "Erro ao atualizar" });
  }
};

// =======================================================
// 🆕 FINALIZAR ATIVIDADE + GERAR CERTIFICADOS
// =======================================================
export const finishActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    // 🔒 Apenas ONG criadora
    if (!activity.createdBy.equals(req.user._id)) {
      return res.status(403).json({
        message: "Apenas a ONG criadora pode finalizar"
      });
    }

    if (activity.status !== "active") {
      return res.status(400).json({
        message: "Atividade já finalizada ou cancelada"
      });
    }

    const participations = await Participation.find({
      activity: id,
      status: "present"
    });

    let certificadosGerados = 0;

    for (const participation of participations) {
      const exists = await Certificate.findOne({
        participation: participation._id
      });

      if (!exists) {
        await Certificate.create({
          user: participation.user,
          activity: activity._id,
          participation: participation._id,
          hours: participation.workloadHours,
          verificationCode: generateVerificationCode()
        });

        certificadosGerados++;
      }
    }

    activity.status = "finished";
    await activity.save();

    return res.json({
      message: "Atividade finalizada com sucesso",
      certificadosGerados
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Erro ao finalizar atividade"
    });
  }
};

// ===========================
// Excluir atividade
// ===========================
export const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    if (!activity.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    await Participation.deleteMany({ activity: id });
    await Activity.findByIdAndDelete(id);

    return res.json({ message: "Atividade excluída" });
  } catch {
    return res.status(500).json({ error: "Erro ao excluir" });
  }
};
