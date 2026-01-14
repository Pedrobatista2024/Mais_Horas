import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function OrgDashboard() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);

  async function loadMyActivities() {
    try {
      const response = await api.get("/activities/my");
      setActivities(response.data);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar suas atividades");
    }
  }

  useEffect(() => {
    loadMyActivities();
  }, []);

  return (
    <div>
      <h1>Painel da Organização</h1>

      <button onClick={() => navigate("/org/create-activity")}>
        Criar atividade
      </button>

      <h2>Minhas Atividades</h2>
      {activities.length === 0 ? (
        <p>Você ainda não criou atividades</p>
      ) : (
        activities.map((a) => (
          <p key={a._id}>{a.title}</p>
        ))
      )}
    </div>
  );
}
