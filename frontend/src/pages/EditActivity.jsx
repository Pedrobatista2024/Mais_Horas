import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

// 🔹 Utilitário
function capitalizeAndTrim(text) {
  const trimmed = String(text || "").trim();
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
          title: activity.title || "",
          description: activity.description || "",
          location: activity.location || "",
          date: activity.date ? String(activity.date).substring(0, 10) : "",
          startTime: activity.startTime || "",
          endTime: activity.endTime || "",
          workloadHours: activity.workloadHours ?? "",
          minParticipants: activity.minParticipants ?? "",
          maxParticipants: activity.maxParticipants ?? "",
        });
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar atividade");
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [id]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const hasParticipants = useMemo(() => participantsCount > 0, [participantsCount]);

  // =========================
  // 🔒 VALIDAÇÕES
  // =========================
  function validateForm() {
    if (!form) return "Form inválido.";

    if (!hasParticipants) {
      const title = capitalizeAndTrim(form.title);
      const description = capitalizeAndTrim(form.description);
      const location = capitalizeAndTrim(form.location);

      if (!title) return "Título é obrigatório.";
      if (title.length > 40) return "Título deve ter no máximo 40 caracteres.";

      if (!description) return "Descrição é obrigatória.";
      if (description.length > 1500) return "Descrição deve ter no máximo 1500 caracteres.";

      if (!location) return "Local é obrigatório.";
      if (location.length > 50) return "Local deve ter no máximo 50 caracteres.";

      if (!form.date) return "Data é obrigatória.";

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activityDate = new Date(form.date);

      if (activityDate < today) return "Não é permitido data no passado.";

      if (!form.startTime || !form.endTime) return "Horário de início e fim são obrigatórios.";

      if (form.startTime >= form.endTime) return "Hora início deve ser menor que a hora fim.";
    }

    if (!form.workloadHours || Number(form.workloadHours) <= 0)
      return "Carga horária deve ser maior que 0.";

    const min = Number(form.minParticipants);
    const max = Number(form.maxParticipants);

    if (min < 1) return "Número mínimo de participantes deve ser no mínimo 1.";

    if (max < min) return "Número máximo não pode ser menor que o mínimo.";

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

    if (hasParticipants) {
      payload = {
        minParticipants: Number(form.minParticipants),
        maxParticipants: Number(form.maxParticipants),
        workloadHours: Number(form.workloadHours),
      };
    } else {
      payload = {
        ...form,
        title: capitalizeAndTrim(form.title),
        description: capitalizeAndTrim(form.description),
        location: capitalizeAndTrim(form.location),
        workloadHours: Number(form.workloadHours),
        minParticipants: Number(form.minParticipants),
        maxParticipants: Number(form.maxParticipants),
      };
    }

    try {
      await api.put(`/activities/${id}`, payload);
      alert("Atividade atualizada com sucesso!");
      navigate(`/org/activity/${id}`);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Erro ao atualizar atividade");
    }
  }

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando...</p>;
  if (!form) return <p style={{ padding: 20, color: "#fff" }}>Atividade não encontrada.</p>;

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh" }}>
      {/* ================= NAVBAR ================= */}
      <div
        style={{
          backgroundColor: "#1F3C88",
          color: "#FFFFFF",
          padding: "15px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Mais<span style={{ color: "#27AE60" }}>Horas</span>
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate(-1)} style={navBtnOutline}>
            ← Voltar
          </button>

          <button type="button" onClick={() => navigate(`/org/activity/${id}`)} style={navBtnPrimary}>
            Detalhes
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, padding: "0 16px" }}>
        <div style={{ maxWidth: 980, width: "100%" }}>
          {/* Header */}
          <div
            style={{
              backgroundColor: "#1F3C88",
              borderRadius: 12,
              padding: "16px 18px",
              color: "#FFFFFF",
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 22 }}>Editar atividade</h1>
              <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
                Atualize as informações da atividade com segurança.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "8px 12px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Inscritos: {participantsCount}
            </div>
          </div>

          {/* Card */}
          <div
            style={{
              marginTop: 16,
              backgroundColor: "#a1aac9",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
            }}
          >
            {hasParticipants && (
              <div
                style={{
                  backgroundColor: "#FFF4E5",
                  border: "1px solid #FFD9A8",
                  color: "#7A4A00",
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                ⚠️{" "}
                {participantsCount === 1
                  ? `Existe ${participantsCount} aluno inscrito.`
                  : `Existem ${participantsCount} alunos inscritos.`}{" "}
                Apenas <b>mínimo</b> e <b>máximo</b> de participantes pode ser editado
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                {/* Campos bloqueados quando tem inscritos */}
                <Field
                  label="Título"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  disabled={hasParticipants}
                  placeholder="Ex: Mutirão de limpeza"
                />

                <Field
                  label="Data"
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  disabled={hasParticipants}
                />

                <Field
                  label="Localização"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  disabled={hasParticipants}
                  placeholder="Ex: Centro, Sobral"
                />

                <Field
                  label="Hora início"
                  name="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={handleChange}
                  disabled={hasParticipants}
                />

                <Field
                  label="Hora fim"
                  name="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={handleChange}
                  disabled={hasParticipants}
                />

                
                <Field
                  label="Carga horária (h)"
                  name="workloadHours"
                  type="number"
                  value={form.workloadHours}
                  onChange={handleChange}
                  placeholder="Ex: 4"
                  disabled={hasParticipants}
                />
                {/* Liberados sempre */}
                <Field
                  label="Mínimo de participantes"
                  name="minParticipants"
                  type="number"
                  value={form.minParticipants}
                  onChange={handleChange}
                  placeholder="Ex: 5"
                />

                <Field
                  label="Máximo de participantes"
                  name="maxParticipants"
                  type="number"
                  value={form.maxParticipants}
                  onChange={handleChange}
                  placeholder="Ex: 20"
                />
              </div>

              {/* Descrição */}
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", marginBottom: 6, color: "#1F3C88", fontWeight: 900 }}>
                  Descrição
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  disabled={hasParticipants}
                  rows={6}
                  placeholder="Descreva a atividade..."
                  style={{
                    ...inputStyle(hasParticipants),
                    resize: "vertical",
                    minHeight: 120,
                    color: "#111827",
                  }}
                />
                {hasParticipants && (
                  <small style={{ color: "#4F5D75", fontWeight: 700 }}>
                    Campo bloqueado porque há alunos inscritos.
                  </small>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" style={btnSuccess}>
                  Salvar alterações
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/org/activity/${id}`)}
                  style={btnPrimary}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>

          <div style={{ height: 28 }} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", placeholder, disabled }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={{ display: "block", marginBottom: 6, color: "#1F3C88", fontWeight: 900 }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...inputStyle(disabled),
          color: "#111827",
        }}
      />
    </div>
  );
}

function inputStyle(disabled) {
  return {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #E0E6F1",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: disabled ? "#F1F3F5" : "#FFFFFF",
    cursor: disabled ? "not-allowed" : "text",
  };
}

const navBtnOutline = {
  backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.4)",
  color: "#FFFFFF",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const navBtnPrimary = {
  backgroundColor: "#2E5AAC",
  border: "none",
  padding: "8px 12px",
  color: "#FFFFFF",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const btnPrimary = {
  backgroundColor: "#2E5AAC",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnSuccess = {
  backgroundColor: "#27AE60",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};
