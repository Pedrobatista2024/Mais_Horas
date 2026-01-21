import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function OrgDashboard() {
  const [activities, setActivities] = useState([]);
  const navigate = useNavigate();

  async function loadActivities() {
    try {
      const response = await api.get("/activities/my");
      setActivities(response.data);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar atividades da ONG");
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  return (
    <div>
      <h1>Painel da Organização</h1>

      <button onClick={() => navigate("/org/create-activity")}>
        Criar atividade
      </button>

      <h3>Minhas Atividades</h3>

      {activities.length === 0 && <p>Nenhuma atividade cadastrada.</p>}

      <ul>
        {activities.map((activity) => (
          <li
            key={activity._id}
            style={{ cursor: "pointer", marginBottom: "10px" }}
            onClick={() => navigate(`/org/activity/${activity._id}`)}
          >
            {activity.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
