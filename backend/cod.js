import { useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

// 🔹 Utilitário: remove espaços extras e capitaliza 1ª letra
function capitalizeAndTrim(text) {
  const trimmed = text.trim();
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
    if (description.length > 1500)
      return "Descrição deve ter no máximo 1500 caracteres.";

    // 🔹 LOCAL
    if (!location) return "Local é obrigatório.";
    if (location.length > 50)
      return "Local deve ter no máximo 50 caracteres.";

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

    if (min < 1) {
      return "O número mínimo de participantes deve ser no mínimo 1.";
    }

    if (max < min) {
      return "O número máximo de participantes não pode ser menor que o mínimo.";
    }

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
      maxParticipants: Number(
        form.maxParticipants || form.minParticipants || 1
      ),
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
    <div style={{ padding: 20 }}>
      <h2>Criar nova atividade</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Título</label><br />
          <input name="title" onChange={handleChange} required />
        </div>

        <div>
          <label>Descrição</label><br />
          <textarea name="description" onChange={handleChange} required />
        </div>

        <div>
          <label>Local</label><br />
          <input name="location" onChange={handleChange} required />
        </div>

        <div>
          <label>Data</label><br />
          <input type="date" name="date" onChange={handleChange} required />
        </div>

        <div>
          <label>Hora início</label><br />
          <input type="time" name="startTime" onChange={handleChange} required />
        </div>

        <div>
          <label>Hora fim</label><br />
          <input type="time" name="endTime" onChange={handleChange} required />
        </div>

        <div>
          <label>Carga horária (horas)</label><br />
          <input type="number" name="workloadHours" onChange={handleChange} required />
        </div>

        <div>
          <label>Nº mínimo de participantes</label><br />
          <input type="number" name="minParticipants" onChange={handleChange} />
        </div>

        <div>
          <label>Nº máximo de participantes</label><br />
          <input type="number" name="maxParticipants" onChange={handleChange} />
        </div>

        <br />
        <button type="submit">Criar atividade</button>
      </form>
    </div>
  );
}



