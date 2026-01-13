import { Link } from "react-router-dom";

export default function OrgDashboard() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>Painel da Organização</h2>

      <ul>
        <li><Link to="/org/activities/create">➕ Criar Atividade</Link></li>
        <li><Link to="/org/activities">📋 Minhas Atividades</Link></li>
      </ul>
    </div>
  );
}
