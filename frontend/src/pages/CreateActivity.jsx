import { useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

// 🔹 Utilitário: remove espaços extras e capitaliza 1ª letra
function capitalizeAndTrim(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default function CreateActivity() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    startTime: "",
    endTime: "",
    workloadHours: "",
    minParticipants: "",
    maxParticipants: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // =========================
  // 🔒 VALIDAÇÕES
  // =========================
  function validateForm() {
    const title = capitalizeAndTrim(form.title);
    const description = capitalizeAndTrim(form.description);
    const location = capitalizeAndTrim(form.location);

    // 🔹 TÍTULO
    if (!title) return "Título é obrigatório.";
    if (title.length > 40) return "Título deve ter no máximo 40 caracteres.";

    // 🔹 DESCRIÇÃO
    if (!description) return "Descrição é obrigatória.";
    if (description.length > 1500) return "Descrição deve ter no máximo 1500 caracteres.";

    // 🔹 LOCAL
    if (!location) return "Local é obrigatório.";
    if (location.length > 50) return "Local deve ter no máximo 50 caracteres.";

    // 🔹 CARGA HORÁRIA
    if (!form.workloadHours || Number(form.workloadHours) <= 0) {
      return "Carga horária deve ser maior que 0.";
    }

    // 🔹 DATA
    if (!form.date) return "Data da atividade é obrigatória.";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activityDate = new Date(form.date);

    if (activityDate < today) {
      return "Não é permitido criar atividade com data no passado.";
    }

    // 🔹 HORÁRIO
    if (!form.startTime || !form.endTime) {
      return "Horário de início e fim são obrigatórios.";
    }
    if (form.startTime >= form.endTime) {
      return "O horário de início deve ser menor que o horário de fim.";
    }

    // 🔹 PARTICIPANTES
    const min = Number(form.minParticipants || 1);
    const max = Number(form.maxParticipants || min);

    if (min < 1) return "O número mínimo de participantes deve ser no mínimo 1.";
    if (max < min) return "O número máximo de participantes não pode ser menor que o mínimo.";

    return null; // ✅ tudo válido
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    const payload = {
      ...form,
      title: capitalizeAndTrim(form.title),
      description: capitalizeAndTrim(form.description),
      location: capitalizeAndTrim(form.location),
      workloadHours: Number(form.workloadHours),
      minParticipants: Number(form.minParticipants || 1),
      maxParticipants: Number(form.maxParticipants || form.minParticipants || 1),
    };

    try {
      await api.post("/activities", payload);
      alert("Atividade criada com sucesso!");
      navigate("/org");
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao criar atividade.");
    }
  }

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
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#FFFFFF",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            ← Voltar
          </button>

          <button
            type="button"
            onClick={() => navigate("/org")}
            style={{
              backgroundColor: "#5C677D",
              border: "none",
              color: "#FFFFFF",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Painel
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, padding: "0 16px" }}>
        <div style={{ maxWidth: 900, width: "100%", margin: "0 auto" }}>
          {/* Header do Card */}
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
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>
                Criar <span style={{ color: "#27AE60" }}>Atividade</span>
              </h1>
              <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
                Preencha os dados abaixo para publicar uma nova atividade.
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
              ONG
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: 16,
              backgroundColor: "#a1aac9",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
              boxSizing: "border-box",
            }}
          >
            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
                alignItems: "start",
              }}
            >
              <Field label="Título" name="title" value={form.title} onChange={handleChange} required />
              <Field label="Local" name="location" value={form.location} onChange={handleChange} required />
              <Field label="Data" name="date" type="date" value={form.date} onChange={handleChange} required />
              <Field label="Hora início" name="startTime" type="time" value={form.startTime} onChange={handleChange} required />
              <Field label="Hora fim" name="endTime" type="time" value={form.endTime} onChange={handleChange} required />
              <Field
                label="Carga horária (horas)"
                name="workloadHours"
                type="number"
                value={form.workloadHours}
                onChange={handleChange}
                required
                placeholder="Ex: 4"
              />
              <Field
                label="Nº mínimo de participantes"
                name="minParticipants"
                type="number"
                value={form.minParticipants}
                onChange={handleChange}
                placeholder="Ex: 5"
              />
              <Field
                label="Nº máximo de participantes"
                name="maxParticipants"
                type="number"
                value={form.maxParticipants}
                onChange={handleChange}
                placeholder="Ex: 20"
              />
            </div>

            {/* Descrição */}
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Descrição</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={6}
                required
                style={{
                  ...inputStyle(false),
                  resize: "vertical",
                  color: "#2C3E50",
                }}
                placeholder="Explique o que será feito, público alvo, materiais necessários, orientações, etc..."
              />
              <small style={{ color: "#4F5D75" }}>Máximo: 1500 caracteres.</small>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button type="submit" style={primaryBtn}>
                Criar atividade
              </button>

              <button type="button" onClick={() => navigate(-1)} style={secondaryBtn}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 6,
  color: "#1F3C88",
  fontWeight: 900,
};

function inputStyle(readOnly) {
  return {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #E0E6F1",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: readOnly ? "#F1F3F5" : "#FFFFFF",
    cursor: readOnly ? "not-allowed" : "text",
    color: "#2C3E50",
  };
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  readOnly = false,
  placeholder,
  required = false,
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelStyle}>
        {label} {required ? <span style={{ color: "#EB5757" }}>*</span> : null}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        required={required}
        style={inputStyle(readOnly)}
      />
    </div>
  );
}

const primaryBtn = {
  backgroundColor: "#27AE60",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const secondaryBtn = {
  backgroundColor: "#2E5AAC",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};
