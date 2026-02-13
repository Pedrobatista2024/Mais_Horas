import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh" }}>

      {/* ================= NAVBAR ================= */}
      <div
        style={{
          backgroundColor: "#1F3C88",
          color: "#FFFFFF",
          padding: "15px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <h2 style={{ margin: 0 }}>
          Mais<span style={{ color: "#27AE60" }}>Horas</span>
        </h2>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              backgroundColor: "#F2994A",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer"
            }}
            onClick={() => navigate("/activities")}
          >
            Buscar Atividades
          </button>

          <button
            style={{
              backgroundColor: "#2E5AAC",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer"
            }}
            onClick={() => navigate("/my-activities")}
          >
            Ver Minhas Atividades
          </button>

          <button
            style={{
              backgroundColor: "#5C677D",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer"
            }}
            onClick={() => navigate("/edit-profile")}
          >
            Editar Perfil
          </button>

          <button
            style={{
              backgroundColor: "#EB5757",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer"
            }}
            onClick={logout}
          >
            ⏻ Sair
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
        <div
          style={{
            backgroundColor: "#a1aac9",
            width: "900px",
            borderRadius: "10px",
            padding: "30px",
            boxShadow: "0 6px 18px rgba(31, 60, 136, 0.08)"
          }}
        >

          {/* ===== TOPO PERFIL ===== */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: "#c8d5ed",
                border: "5px solid #ffff",
                marginTop: -70
              }}
            />
            <div>
              <h2 style={{ margin: 0, color: "#2C3E50" }}>
                Nome do Aluno <span style={{ color: "#27AE60" }}>✔</span>
              </h2>
            </div>
          </div>

          {/* ===== ESTATÍSTICAS ===== */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 30,
              textAlign: "center",
              borderTop: "1px solid #E0E6F1",
              borderBottom: "1px solid #E0E6F1",
              padding: "20px 0"
            }}
          >
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88", margin: 0 }}>0</h3>
              <p style={{ color: "#2C3E50" }}>Atividades Voluntárias</p>
            </div>

            <div
              style={{
                flex: 1,
                borderLeft: "1px solid #E0E6F1",
                borderRight: "1px solid #E0E6F1"
              }}
            >
              <h3 style={{ color: "#1F3C88", margin: 0 }}>0</h3>
              <p style={{ color: "#2C3E50" }}>Horas Contribuídas</p>
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88", margin: 0 }}>0</h3>
              <p style={{ color: "#2C3E50" }}>Certificados Obtidos</p>
            </div>
          </div>

          {/* ===== CONTEÚDO INFERIOR ===== */}
          <div style={{ display: "flex", gap: 30, marginTop: 30 }}>

            {/* SOBRE MIM */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88" }}>Sobre Mim</h3>
              <p style={{ color: "#4F5D75" }}>
                —
              </p>
            </div>

            {/* CERTIFICADOS */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88" }}>Certificados Obtidos</h3>

              <div
                style={{
                  backgroundColor: "#F7F9FC",
                  padding: 15,
                  borderRadius: 8,
                  marginBottom: 10,
                  border: "1px solid #E0E6F1"
                }}
              >
                <span style={{ color: "#F2C94C" }}>🏅</span> Nome da atividade
                <br />
                <small style={{ color: "#6C757D" }}>Data</small>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
