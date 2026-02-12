import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

// 🔹 Utilitário
function capitalizeAndTrim(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default function EditActivity() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [participantsCount, setParticipantsCount] = useState(0);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      try {
        const response = await api.get(`/activities/${id}`);
        const activity = response.data;

        const inscritos = activity.participants?.length || 0;
        setParticipantsCount(inscritos);

        setForm({
          title: activity.title,
          description: activity.description,
          location: activity.location,
          date: activity.date?.substring(0, 10),
          startTime: activity.startTime,
          endTime: activity.endTime,
          workloadHours: activity.workloadHours,
          minParticipants: activity.minParticipants,
          maxParticipants: activity.maxParticipants
        });
      } catch (error) {
        alert("Erro ao carregar atividade");
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [id]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // =========================
  // 🔒 VALIDAÇÕES
  // =========================
  function validateForm() {
    const hasParticipants = participantsCount > 0;

    if (!hasParticipants) {
      const title = capitalizeAndTrim(form.title);
      const description = capitalizeAndTrim(form.description);
      const location = capitalizeAndTrim(form.location);

      if (!title) return "Título é obrigatório.";
      if (title.length > 40) return "Título deve ter no máximo 40 caracteres.";

      if (!description) return "Descrição é obrigatória.";
      if (description.length > 1500)
        return "Descrição deve ter no máximo 1500 caracteres.";

      if (!location) return "Local é obrigatório.";
      if (location.length > 50)
        return "Local deve ter no máximo 50 caracteres.";

      if (!form.date) return "Data é obrigatória.";

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activityDate = new Date(form.date);

      if (activityDate < today)
        return "Não é permitido data no passado.";

      if (!form.startTime || !form.endTime)
        return "Horário de início e fim são obrigatórios.";

      if (form.startTime >= form.endTime)
        return "Hora início deve ser menor que a hora fim.";
    }

    if (!form.workloadHours || Number(form.workloadHours) <= 0)
      return "Carga horária deve ser maior que 0.";

    const min = Number(form.minParticipants);
    const max = Number(form.maxParticipants);

    if (min < 1)
      return "Número mínimo de participantes deve ser no mínimo 1.";

    if (max < min)
      return "Número máximo não pode ser menor que o mínimo.";

    if (participantsCount > 0 && max < participantsCount) {
      return `O máximo não pode ser menor que ${participantsCount}.`;
    }

    return null;
  }

  // =========================
  // 🚀 SUBMIT
  // =========================
  async function handleSubmit(e) {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    let payload = {};

    if (participantsCount > 0) {
      payload = {
        minParticipants: Number(form.minParticipants),
        maxParticipants: Number(form.maxParticipants),
        workloadHours: Number(form.workloadHours)
      };
    } else {
      payload = {
        ...form,
        title: capitalizeAndTrim(form.title),
        description: capitalizeAndTrim(form.description),
        location: capitalizeAndTrim(form.location),
        workloadHours: Number(form.workloadHours),
        minParticipants: Number(form.minParticipants),
        maxParticipants: Number(form.maxParticipants)
      };
    }

    try {
      await api.put(`/activities/${id}`, payload);
      alert("Atividade atualizada com sucesso!");
      navigate(`/org/activity/${id}`);
    } catch (error) {
      alert(error.response?.data?.message || "Erro ao atualizar atividade");
    }
  }

  if (loading) return <p>Carregando...</p>;
  if (!form) return <p>Atividade não encontrada.</p>;

  const hasParticipants = participantsCount > 0;

  // =========================
  // 🖼️ LAYOUT (INALTERADO)
  // =========================
  return (
    <div style={{ padding: "20px" }}>
      <h1>Editar atividade</h1>

      {hasParticipants && (
        <p style={{ color: "orange" }}>
          {participantsCount === 1
            ? `Existe ${participantsCount} aluno inscrito.`
            : `Existem ${participantsCount} alunos inscritos.`}
          Apenas mínimo, máximo e as horas podem ser alterados.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10, width: 350 }}
      >
        {!hasParticipants && (
          <>
            <p>Título</p>
            <input name="title" value={form.title} onChange={handleChange} />

            <p>Descrição</p>
            <textarea name="description" value={form.description} onChange={handleChange} />

            <p>Data</p>
            <input type="date" name="date" value={form.date} onChange={handleChange} />

            <p>Localização</p>
            <input name="location" value={form.location} onChange={handleChange} />

            <p>Hora Inicio</p>
            <input type="time" name="startTime" value={form.startTime} onChange={handleChange} />

            <p>Hora Fim</p>
            <input type="time" name="endTime" value={form.endTime} onChange={handleChange} />

            <p>Carga Horaria</p>
            <input
              type="number"
              name="workloadHours"
              value={form.workloadHours}
              onChange={handleChange}
            />
          </>
        )}

        <p>Minimo</p>
        <input
          type="number"
          name="minParticipants"
          value={form.minParticipants}
          onChange={handleChange}
        />

        <p>Maximo</p>
        <input
          type="number"
          name="maxParticipants"
          value={form.maxParticipants}
          onChange={handleChange}
        />

        <button type="submit">Salvar alterações</button>
        <button type="button" onClick={() => navigate(`/org/activity/${id}`)}>
          Cancelar
        </button>
      </form>
    </div>
  );
}
