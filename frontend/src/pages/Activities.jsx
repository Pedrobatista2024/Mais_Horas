import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      try {
        const response = await api.get("/activities");
        setActivities(response.data);
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar atividades");
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, []);

  async function handleParticipate(activityId) {
    try {
      await api.post("/participations", {
        activityId,
      });

      alert("Participação registrada com sucesso!");
    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.message ||
          "Erro ao registrar participação"
      );
    }
  }

  if (loading) {
    return <p>Carregando atividades...</p>;
  }

  return (
    <div>
      <h1>Atividades</h1>

      {activities.length === 0 ? (
        <p>Nenhuma atividade cadastrada</p>
      ) : (
        <ul>
          {activities.map((activity) => (
            <li key={activity._id}>
              <strong>{activity.title}</strong>
              <br />
              <span>{activity.location}</span>
              <br />
              <small>
                {new Date(activity.date).toLocaleDateString()}
              </small>
              <br /><br />

              <button
                onClick={() => handleParticipate(activity._id)}
              >
                Participar
              </button>

              <hr />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
