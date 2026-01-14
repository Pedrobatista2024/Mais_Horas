import { useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

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

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post("/activities", form);
      alert("Atividade criada com sucesso!");
      navigate("/org");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Erro ao criar atividade");
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
