import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function OrgActivityDetails() {
  const { id } = useParams(); // ID da atividade
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadActivity() {
    try {
      const response = await api.get(`/activities/${id}`);
      setActivity(response.data);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar detalhes da atividade");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  if (loading) {
    return <p>Carregando dados...</p>;
  }

  if (!activity) {
    return <p>Atividade não encontrada.</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>{activity.title}</h1>

      <p><strong>Local:</strong> {activity.location}</p>
      <p><strong>Data:</strong> {new Date(activity.date).toLocaleDateString()}</p>

      {/* informações adicionais */}
      <div style={{ marginTop: "10px" }}>
        <p><strong>Descrição:</strong> {activity.description}</p>
        <p><strong>Horário:</strong> {activity.startTime} — {activity.endTime}</p>
        <p><strong>Vagas:</strong> mín {activity.minParticipants} / máx {activity.maxParticipants}</p>
        <p><strong>Carga horária:</strong> {activity.workloadHours} horas</p>
      </div>

      <br />

      <button
        onClick={() => navigate(`/org/activity/${id}/participants`)}
        style={{ marginRight: "10px" }}
      >
        Ver participantes
      </button>

      <button onClick={() => navigate("/org")}>
        Voltar
      </button>
    </div>
  );
}
