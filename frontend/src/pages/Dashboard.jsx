import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Bem-vindo ao painel</p>

      <button onClick={() => navigate("/activities")}>
        Ver atividades
      </button>

      <br /><br />

      {/* 🔥 NOVO BOTÃO */}
      <button onClick={() => navigate("/my-certificates")}>
        Meus certificados
      </button>

      <br /><br />

      <button onClick={logout}>
        Sair
      </button>
    </div>
  );
}
