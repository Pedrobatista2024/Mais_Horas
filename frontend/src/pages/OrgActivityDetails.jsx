import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function OrgActivityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🆕 estado para mensagens de erro (regra de presença)
  const [errorMessage, setErrorMessage] = useState("");

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

  async function handleDelete() {
    const confirma = confirm("Tem certeza que deseja excluir esta atividade?");
    if (!confirma) return;

    try {
      await api.delete(`/activities/${id}`);
      alert("Atividade excluída com sucesso!");
      navigate("/org");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir atividade");
    }
  }

  // 🔥 FINALIZAR ATIVIDADE (com regra de presença)
  async function handleFinishActivity() {
    setErrorMessage("");

    const confirma = confirm(
      "Ao finalizar a atividade, ela será encerrada e os certificados serão gerados para os alunos presentes. Deseja continuar?"
    );
    if (!confirma) return;

    try {
      await api.post(`/activities/${id}/finish`);
      alert("Atividade finalizada com sucesso!");
      loadActivity(); // atualiza status
    } catch (error) {
      console.error(error);

      const message =
        error.response?.data?.message ||
        "Erro ao finalizar atividade";

      setErrorMessage(message);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  if (loading) return <p>Carregando dados...</p>;
  if (!activity) return <p>Atividade não encontrada.</p>;

  const isFinished = activity.status === "finished";

  return (
    <div style={{ padding: "20px" }}>
      <h1>{activity.title}</h1>

      <p><strong>Local:</strong> {activity.location}</p>
      <p><strong>Data:</strong> {new Date(activity.date).toLocaleDateString()}</p>
      <p><strong>Status:</strong> {activity.status}</p>

      <div style={{ marginTop: "10px" }}>
        <p><strong>Descrição:</strong> {activity.description}</p>
        <p><strong>Horário:</strong> {activity.startTime} — {activity.endTime}</p>
        <p>
          <strong>Vagas:</strong> mín {activity.minParticipants} / máx {activity.maxParticipants}
        </p>
        <p><strong>Carga horária:</strong> {activity.workloadHours} horas</p>
      </div>

      {/* 🆕 Mensagem clara de erro (regra de presença) */}
      {errorMessage && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#fdecea",
            color: "#b71c1c",
            border: "1px solid #f5c6cb",
            borderRadius: "4px"
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      <br />

      {/* ✅ Sempre disponível */}
      <button
        onClick={() => navigate(`/org/activity/${id}/participants`)}
        style={{ marginRight: "10px" }}
      >
        Ver participantes
      </button>

      {/* ✏️ Editar e 🗑️ Excluir SOMENTE se não estiver finalizada */}
      {!isFinished && (
        <>
          <button
            onClick={() => navigate(`/org/activity/${id}/edit`)}
            style={{ marginRight: "10px" }}
          >
            Editar atividade
          </button>

          <button
            onClick={handleDelete}
            style={{
              marginRight: "10px",
              color: "white",
              backgroundColor: "red"
            }}
          >
            Excluir atividade
          </button>
        </>
      )}

      {/* 🔥 Finalizar só aparece se ainda estiver ativa */}
      {!isFinished && (
        <button
          onClick={handleFinishActivity}
          style={{
            marginRight: "10px",
            backgroundColor: "#2e7d32",
            color: "white"
          }}
        >
          Finalizar atividade
        </button>
      )}

      <button onClick={() => navigate(-1)}>
        Voltar
      </button>
    </div>
  );
}
