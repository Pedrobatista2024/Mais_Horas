import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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

  const photoSrc = useMemo(() => {
    const photoPath = orgProfile?.photo;
    if (!photoPath) return "";
    const normalized = String(photoPath).replace(/\\/g, "/");
    if (normalized.startsWith("http")) return normalized;
    return `${API_BASE_URL}/${normalized}`;
  }, [orgProfile?.photo]);

  // ✅ Regra: só pode criar atividade se o perfil estiver completo (website é opcional)
  const isOrgProfileComplete = useMemo(() => {
    const responsibleNameOk = Boolean(String(profile?.name || "").trim());
    const orgNameOk = Boolean(String(orgProfile?.organizationName || "").trim());
    const descOk = Boolean(String(orgProfile?.description || "").trim());
    const phoneOk = Boolean(String(orgProfile?.phone || "").trim());
    const addressOk = Boolean(String(orgProfile?.address || "").trim());
    const photoOk = Boolean(String(orgProfile?.photo || "").trim()); // foto (upload) é obrigatória

    return responsibleNameOk && orgNameOk && descOk && phoneOk && addressOk && photoOk;
  }, [
    profile?.name,
    orgProfile?.organizationName,
    orgProfile?.description,
    orgProfile?.phone,
    orgProfile?.address,
    orgProfile?.photo,
  ]);

  function handleCreateActivityClick() {
    if (loading) return;

    if (!isOrgProfileComplete) {
      alert(
        "Para criar atividades, você precisa preencher os dados obrigatórios do perfil da ONG (incluindo foto)."
      );
      navigate("/org/profile/edit");
      return;
    }

    navigate("/org/create-activity");
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
            onClick={handleCreateActivityClick}
            style={{
              backgroundColor: "#27AE60",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer",
              borderRadius: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
              opacity: loading ? 0.7 : 1,
            }}
            title={
              loading
                ? "Carregando..."
                : !isOrgProfileComplete
                ? "Complete o perfil da ONG para criar atividades"
                : "Criar atividade"
            }
          >
            Criar atividade
          </button>

          <button
            onClick={() => navigate("/org/my-activities")}
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
            Minhas atividades
          </button>

          <button
            onClick={() => navigate("/org/profile")}
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
            Perfil
          </button>

          <button
            onClick={logout}
            style={{
              backgroundColor: "#EB5757",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer",
              borderRadius: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            ⏻ Sair
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
          <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Painel da Organização</h1>

          {/* ===== CARD PERFIL ===== */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E0E6F1",
              padding: 16,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
            }}
          >
            {loading ? (
              <p style={{ color: "#2C3E50", margin: 0 }}>Carregando dados...</p>
            ) : (
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* FOTO */}
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 14,
                    backgroundColor: "#c8d5ed",
                    border: "4px solid #fff",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
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

                {/* DADOS */}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <h2 style={{ margin: 0, color: "#2C3E50" }}>
                    {orgProfile.organizationName || "Nome da ONG"}{" "}
                    <span style={{ color: "#27AE60" }}>✔</span>
                  </h2>

                  <div style={{ marginTop: 6, color: "#4F5D75", fontWeight: 700 }}>
                    Responsável: {profile?.name || "Não informado"}
                  </div>

                  <div style={{ marginTop: 2, color: "#4F5D75", fontWeight: 700 }}>
                    Email: {profile?.email || "Não informado"}
                  </div>

                  {/* Info grid */}
                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <InfoRow label="Telefone" value={orgProfile.phone || "Não informado"} />
                    <InfoRow label="Site" value={orgProfile.website || "Não informado"} />
                    <InfoRow label="Endereço" value={orgProfile.address || "Não informado"} />
                  </div>

                  {/* Descrição */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: "#6C757D", fontSize: 12, fontWeight: 800 }}>Descrição</div>
                    <div style={{ color: "#4F5D75", marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                      {orgProfile.description && String(orgProfile.description).trim()
                        ? orgProfile.description
                        : "Não informado"}
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <button
                      onClick={() => navigate("/org/profile")}
                      style={{
                        backgroundColor: "#F2994A",
                        border: "none",
                        padding: "10px 14px",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        borderRadius: 10,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Ver Perfil Publico
                    </button>

                    <button
                      onClick={() => navigate("/org/profile/edit")}
                      style={{
                        backgroundColor: "#5C677D",
                        border: "none",
                        padding: "10px 14px",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        borderRadius: 10,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Editar Perfil
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===== HINTS / PRÓXIMOS PASSOS (só visual) ===== */}
          <div
            style={{
              marginTop: 14,
              backgroundColor: "#F7F9FC",
              border: "1px solid #E0E6F1",
              borderRadius: 12,
              padding: 14,
              color: "#4F5D75",
            }}
          >
            <strong style={{ color: "#2C3E50" }}>Dica:</strong> mantenha o perfil completo para gerar mais confiança
            nos alunos (foto, descrição, endereço e contato).
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E0E6F1",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 6px 18px rgba(31, 60, 136, 0.04)",
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
