import Activity from "../models/Activity.js";
import Participation from "../models/Participation.js";
import Certificate from "../models/Certificate.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";

// 👇 LOG GLOBAL
console.log("📂 [CARREGAMENTO] activity.controller.js carregado");

// ✅ Helper: converte "YYYY-MM-DD" para Date em UTC (12:00) pra evitar -1 dia no fuso
function parseDateOnlyToUTCNoon(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;

  // aceita "YYYY-MM-DD" (do input type="date")
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return null;

  // 12:00 UTC evita cair no dia anterior em fusos negativos
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;

  return dt;
}

// ===========================
// Criar atividade (ONG)
// ===========================
export const createActivity = async (req, res) => {
  try {
    let {
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

    // 🔹 Normalização básica
    title = title?.trim();
    description = description?.trim();
    location = location?.trim();

    // ✅ Converte data "YYYY-MM-DD" para UTC 12:00 (corrige -1 dia)
    const activityDate = parseDateOnlyToUTCNoon(date);
    if (!activityDate) {
      return res.status(400).json({ message: "Data inválida" });
    }

    // 🔹 Data não pode ser no passado
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // compara apenas pelo dia (ajustando activityDate para 00:00 local antes de comparar)
    const compareActivity = new Date(activityDate);
    compareActivity.setHours(0, 0, 0, 0);

    if (compareActivity < today) {
      return res.status(400).json({
        message: "A data da atividade não pode ser no passado"
      });
    }

    // 🔹 Horário
    if (startTime >= endTime) {
      return res.status(400).json({
        message: "O horário inicial deve ser menor que o horário final"
      });
    }

    // 🔹 Participantes
    if (minParticipants < 1) {
      return res.status(400).json({
        message: "O mínimo de participantes deve ser pelo menos 1"
      });
    }

    if (maxParticipants < minParticipants) {
      return res.status(400).json({
        message: "O máximo de participantes não pode ser menor que o mínimo"
      });
    }

    // 🔹 Carga horária
    if (!workloadHours || workloadHours <= 0) {
      return res.status(400).json({
        message: "Carga horária deve ser maior que 0"
      });
    }

    const activity = await Activity.create({
      title,
      description,
      date: activityDate, // ✅ corrigido aqui
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
    console.error("❌ Erro ao criar atividade:", error);
    return res.status(400).json({
      message: error.message || "Erro ao criar atividade"
    });
  }
};

// ===========================
// Listar todas (alunos)
// ===========================
export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find().populate("createdBy", "name email");

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

    const activity = await Activity.findById(id).populate("createdBy", "name email");

    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    const participations = await Participation.find({ activity: id }).populate("user", "name email");

    const activityData = activity.toObject();
    activityData.participants = participations;

    return res.json(activityData);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar detalhes" });
  }
};

// ===========================
// Inscrição
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
  } catch {
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
    let camposParaAtualizar = {};

    // 1. Validação de limite de participantes
    if (req.body.maxParticipants !== undefined && req.body.maxParticipants < inscritos) {
      return res.status(400).json({
        message: `O número máximo não pode ser menor que o total de inscritos (${inscritos}).`
      });
    }

    // 2. Definir quais campos podem ser alterados conforme sua regra
    if (inscritos > 0) {
      // REGRA: Tem inscritos? Apenas min e max.
      if (req.body.minParticipants !== undefined) camposParaAtualizar.minParticipants = req.body.minParticipants;
      if (req.body.maxParticipants !== undefined) camposParaAtualizar.maxParticipants = req.body.maxParticipants;
      console.log("📝 Atualizando apenas limites (Atividade com inscritos)");
    } else {
      // REGRA: Sem inscritos? Pode editar tudo.
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

      camposParaAtualizar = {
        title,
        description,
        location,
        workloadHours,
        startTime,
        endTime,
        minParticipants,
        maxParticipants
      };

      // ✅ Corrige data no UPDATE também
      if (date !== undefined) {
        const parsed = parseDateOnlyToUTCNoon(date);
        if (!parsed) {
          return res.status(400).json({ message: "Data inválida" });
        }

        // opcional: impedir atualizar para data passada
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const compareActivity = new Date(parsed);
        compareActivity.setHours(0, 0, 0, 0);

        if (compareActivity < today) {
          return res.status(400).json({
            message: "A data da atividade não pode ser no passado"
          });
        }

        camposParaAtualizar.date = parsed;
      }

      console.log("📝 Atualizando todos os campos (Atividade sem inscritos)");
    }

    // 3. ATUALIZAÇÃO SEGURA
    const activityAtualizada = await Activity.findByIdAndUpdate(
      id,
      { $set: camposParaAtualizar },
      { new: true, runValidators: true }
    );

    return res.json({
      message: "Atividade atualizada com sucesso",
      activity: activityAtualizada
    });
  } catch (error) {
    console.error("❌ Erro detalhado no terminal:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar atividade" });
  }
};

// =======================================================
// 🆕 ATUALIZAR PRESENÇA DO PARTICIPANTE
// =======================================================
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params; // activityId
    const { userId, status } = req.body;

    if (!["present", "absent"].includes(status)) {
      return res.status(400).json({
        message: "Status inválido"
      });
    }

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    if (!activity.createdBy.equals(req.user._id)) {
      return res.status(403).json({
        message: "Apenas a ONG criadora pode alterar presenças"
      });
    }

    const participation = await Participation.findOne({
      activity: id,
      user: userId
    });

    if (!participation) {
      return res.status(404).json({
        message: "Participação não encontrada"
      });
    }

    participation.status = status;
    await participation.save();

    return res.json({
      message: "Presença atualizada com sucesso"
    });
  } catch {
    return res.status(500).json({
      error: "Erro ao atualizar presença"
    });
  }
};

// =======================================================
// 🔒 FINALIZAR ATIVIDADE (COM REGRA NOVA)
// =======================================================
export const finishActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: "Atividade não encontrada" });
    }

    console.log("⏱️ workloadHours da atividade:", activity.workloadHours);

    if (!activity.workloadHours || activity.workloadHours <= 0) {
      return res.status(400).json({
        message: "Carga horária inválida. Verifique a atividade antes de finalizar."
      });
    }

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

    // 🚨 regra: não pode ter pendentes
    const pendentes = await Participation.countDocuments({
      activity: id,
      status: "pending"
    });

    if (pendentes > 0) {
      return res.status(400).json({
        message: "Finalize a presença de todos os participantes antes de encerrar a atividade"
      });
    }

    // participantes presentes
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
          hours: activity.workloadHours,
          verificationCode: generateVerificationCode()
        });

        certificadosGerados++;
      }
    }

    // ✅ ATUALIZA SEM VALIDAR participants
    await Activity.updateOne({ _id: id }, { $set: { status: "finished" } });

    return res.json({
      message: "Atividade finalizada com sucesso",
      certificadosGerados
    });
  } catch (error) {
    console.error("❌ Erro ao finalizar atividade:", error);
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