import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function OrgProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get("/users/profile");
        setUser(response.data.user);
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar perfil da ONG");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return <p style={{ color: "#fff", padding: "40px" }}>Carregando perfil...</p>;
  }

  if (!user) return null;

  const profile = user.organizationProfile || {};
  const photoUrl = profile.photo; // caminho salvo no backend

  return (
    <div
      style={{
        padding: "40px",
        minHeight: "100vh",
        backgroundColor: "#1f1f1f",
        color: "#fff",
      }}
    >
      <h1>Perfil da Organização</h1>

      <div
        style={{
          backgroundColor: "#2a2a2a",
          padding: "24px",
          borderRadius: "8px",
          marginTop: "20px",
          maxWidth: "600px",
        }}
      >
        {/* FOTO DA ONG */}
        <div
          style={{
            width: "150px",
            height: "150px",
            borderRadius: "8px",
            backgroundColor: "#3a3a3a",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Foto da ONG"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span style={{ color: "#aaa", fontSize: "14px" }}>
              Sem foto
            </span>
          )}
        </div>

        <p><strong>Nome do responsável:</strong> {user.name}</p>
        <p><strong>E-mail:</strong> {user.email}</p>

        <hr style={{ margin: "20px 0", opacity: 0.3 }} />

        <p><strong>Nome da ONG:</strong> {profile.organizationName || "-"}</p>
        <p><strong>Descrição:</strong> {profile.description || "-"}</p>
        <p><strong>Telefone:</strong> {profile.phone || "-"}</p>
        <p><strong>Endereço:</strong> {profile.address || "-"}</p>
        <p><strong>Site:</strong> {profile.website || "-"}</p>
      </div>

      {/* AÇÕES */}
      <div style={{ marginTop: "20px" }}>
        <button
          translate="no"
          onClick={() => navigate("/org/profile/edit")}
          style={{
            marginRight: "10px",
            padding: "10px 16px",
            backgroundColor: "#1565c0",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Editar Perfil
        </button>

        <button
          onClick={() => navigate("/org")}
          style={{
            padding: "10px 16px",
            backgroundColor: "#424242",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Voltar ao painel
        </button>
      </div>
    </div>
  );
}
