import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

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

  const profile = user?.organizationProfile || {};

  const photoSrc = useMemo(() => {
    const photoPath = profile?.photo;
    if (!photoPath) return "";
    const normalized = String(photoPath).replace(/\\/g, "/");
    // se algum dia você salvar URL completa no backend, isso cobre também
    if (normalized.startsWith("http")) return normalized;
    return `${API_BASE_URL}/${normalized}`;
  }, [profile?.photo]);

  if (loading) {
    return <p style={{ color: "#fff", padding: 40 }}>Carregando perfil...</p>;
  }

  if (!user) return null;

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
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Mais<span style={{ color: "#27AE60" }}>Horas</span>
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/org/profile/edit")}
            style={{
              backgroundColor: "#5C677D",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer",
              borderRadius: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Editar Perfil
          </button>

          <button
            onClick={() => navigate("/org")}
            style={{
              backgroundColor: "#2E5AAC",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer",
              borderRadius: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Voltar ao painel
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, padding: "0 16px" }}>
        <div
          style={{
            backgroundColor: "#a1aac9",
            width: "900px",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
          }}
        >
          {/* ===== TOPO PERFIL ===== */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 14,
                backgroundColor: "#c8d5ed",
                border: "5px solid #fff",
                marginTop: -70,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Foto da ONG"
            >
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Foto da ONG"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ color: "#1F3C88", fontWeight: 900 }}>Sem foto</span>
              )}
            </div>

            <div style={{ minWidth: 260, flex: 1 }}>
              <h2 style={{ margin: 0, color: "#2C3E50" }}>
                {profile.organizationName || "Nome da ONG"}{" "}
                <span style={{ color: "#27AE60" }}>✔</span>
              </h2>

              <div style={{ marginTop: 6, color: "#4F5D75", fontWeight: 700 }}>
                Responsável: {user.name || "-"}
              </div>

              <div style={{ marginTop: 2, color: "#4F5D75", fontWeight: 700 }}>
                Email: {user.email || "-"}
              </div>
            </div>
          </div>

          {/* ===== BLOQUINHOS (INFO) ===== */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              marginTop: 26,
            }}
          >
            <InfoBox label="Telefone" value={profile.phone || "-"} />
            <InfoBox label="Endereço" value={profile.address || "-"} />
            <InfoBox label="Site" value={profile.website || "-"} />
          </div>

          {/* ===== DESCRIÇÃO ===== */}
          <div style={{ marginTop: 16 }}>
            <h3 style={{ color: "#1F3C88", marginBottom: 8 }}>Descrição</h3>

            <div
              style={{
                backgroundColor: "#F7F9FC",
                border: "1px solid #E0E6F1",
                borderRadius: 12,
                padding: 14,
                color: "#4F5D75",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
              }}
            >
              {profile.description && String(profile.description).trim() ? profile.description : "—"}
            </div>
          </div>

          {/* ===== AÇÕES (EM BAIXO TAMBÉM) ===== */}
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/org/profile/edit")}
              style={{
                backgroundColor: "#27AE60",
                border: "none",
                padding: "10px 14px",
                color: "#FFFFFF",
                cursor: "pointer",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              Editar informações
            </button>

            <button
              onClick={() => navigate("/org")}
              style={{
                backgroundColor: "#5C677D",
                border: "none",
                padding: "10px 14px",
                color: "#FFFFFF",
                cursor: "pointer",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E0E6F1",
        borderRadius: 12,
        padding: 14,
        boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
        minWidth: 0,
      }}
    >
      <div style={{ color: "#6C757D", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: "#2C3E50", fontWeight: 900, marginTop: 6, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}
