import { useNavigate } from "react-router-dom";

export default function OrgDashboard() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Painel da Organização</h1>

      <br />

      <button
        onClick={() => navigate("/org/create-activity")}
        style={{ marginRight: "10px" }}
      >
        Criar atividade
      </button>

      <button
        onClick={() => navigate("/org/my-activities")}
      >
        Minhas atividades
      </button>

      <br /><br />

      <button onClick={logout}>Sair</button>
    </div>
  );
}
