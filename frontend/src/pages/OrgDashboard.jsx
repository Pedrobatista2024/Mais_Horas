import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

export default function OrgDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  async function loadProfile() {
    try {
      const response = await api.get("/users/profile");
      setProfile(response.data.user);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar perfil da ONG");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const orgProfile = profile?.organizationProfile || {};
  const photo = orgProfile.photo;

  return (
    <div
      style={{
        padding: "40px",
        minHeight: "100vh",
        backgroundColor: "#1f1f1f",
        color: "#fff",
      }}
    >
      <h1 style={{ marginBottom: "30px" }}>Painel da Organização</h1>

      {/* Ações principais */}
      <div style={{ marginBottom: "30px" }}>
        <button
          onClick={() => navigate("/org/create-activity")}
          style={{
            marginRight: "10px",
            padding: "10px 16px",
            backgroundColor: "#2e7d32",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Criar atividade
        </button>

        <button
          onClick={() => navigate("/org/my-activities")}
          style={{
            padding: "10px 16px",
            backgroundColor: "#1565c0",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Minhas atividades
        </button>
      </div>

      {/* PERFIL DA ONG */}
      <div
        style={{
          backgroundColor: "#2a2a2a",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "30px",
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
        }}
      >
        {/* FOTO DA ONG (sempre aparece) */}
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "8px",
            backgroundColor: "#3a3a3a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {photo ? (
            <img
              src={`${API_BASE_URL}/${profile.photo}`}
              alt="Foto da ONG"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span style={{ fontSize: "12px", color: "#aaa", textAlign: "center" }}>
              Sem foto
            </span>
          )}
        </div>

        {/* DADOS */}
        <div>
          <h2>Perfil da ONG</h2>

          {loading ? (
            <p>Carregando dados...</p>
          ) : (
            <>
              <p>
                <strong>Nome:</strong>{" "}
                {orgProfile.organizationName || "Não informado"}
              </p>
              <p>
                <strong>Descrição:</strong>{" "}
                {orgProfile.description || "Não informado"}
              </p>
              <p>
                <strong>Telefone:</strong>{" "}
                {orgProfile.phone || "Não informado"}
              </p>
              <p>
                <strong>Site:</strong>{" "}
                {orgProfile.website || "Não informado"}
              </p>
              <p>
                <strong>Endereço:</strong>{" "}
                {orgProfile.address || "Não informado"}
              </p>

              <button
                onClick={() => navigate("/org/profile")}
                style={{
                  marginTop: "15px",
                  padding: "10px 16px",
                  backgroundColor: "#f9a825",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Ver perfil completo
              </button>
            </>
          )}
        </div>
      </div>

      <button
        onClick={logout}
        style={{
          padding: "10px 16px",
          backgroundColor: "#c62828",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Sair
      </button>
    </div>
  );
}
