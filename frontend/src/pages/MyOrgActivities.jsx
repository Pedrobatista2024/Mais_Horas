import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function MyOrgActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function loadActivities() {
    try {
      const response = await api.get("/activities/my");
      setActivities(response.data);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar atividades");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  if (loading) return <p>Carregando atividades...</p>;

  const pending = activities.filter(a => a.status !== "finished");
  const finished = activities.filter(a => a.status === "finished");

  return (
    <div style={{ padding: "20px" }}>
      <h1>Minhas Atividades</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
          marginTop: "30px"
        }}
      >
        {/* COLUNA PENDENTES */}
        <div>
          <h2>⏳ Atividades Pendentes</h2>

          {pending.length === 0 ? (
            <p>Nenhuma atividade pendente</p>
          ) : (
            pending.map(activity => (
              <div
                key={activity._id}
                style={{
                  border: "1px solid #faf8f8",
                  padding: "12px",
                  borderRadius: "6px",
                  marginBottom: "10px",
                  backgroundColor: "#416441",
                  cursor: "pointer"
                }}
                onClick={() =>
                  navigate(`/org/activity/${activity._id}`)
                }
              >
                <strong>{activity.title}</strong>
                <p style={{ margin: 0 }}>
                  {new Date(activity.date).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>

        {/* COLUNA FINALIZADAS */}
        <div>
          <h2>✅ Atividades Finalizadas</h2>

          {finished.length === 0 ? (
            <p>Nenhuma atividade finalizada</p>
          ) : (
            finished.map(activity => (
              <div
                key={activity._id}
                style={{
                  border: "1px solid #b1b108",
                  padding: "12px",
                  borderRadius: "6px",
                  marginBottom: "10px",
                  backgroundColor: "#008000",
                  cursor: "pointer"
                }}
                onClick={() =>
                  navigate(`/org/activity/${activity._id}`)
                }
              >
                <strong>{activity.title}</strong>
                <p style={{ margin: 0 }}>
                  {new Date(activity.date).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <br />

      <button onClick={() => navigate("/org")}>
        Voltar ao painel
      </button>
    </div>
  );
}
