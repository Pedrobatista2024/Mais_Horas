// OrgPublicProfile.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

export default function OrgPublicProfile() {
  const navigate = useNavigate();
  const params = useParams();

  const orgId = params.orgId || params.id; // ✅ aceita os 2 formatos

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);

  async function loadPublicProfile() {
    try {
      const response = await api.get(`/users/org/${orgId}/public`);
      setOrg(response.data?.user || null);
    } catch (error) {
      console.error(error);
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setOrg(null);
      return;
    }
    loadPublicProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const profile = org?.organizationProfile || {};

  const photoSrc = useMemo(() => {
    const photoPath = profile?.photo;
    if (!photoPath) return "";
    const normalized = String(photoPath).replace(/\\/g, "/");
    if (normalized.startsWith("http")) return normalized;
    return `${API_BASE_URL}/${normalized}`;
  }, [profile?.photo]);

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando...</p>;

  if (!org) {
    return (
      <div style={{ backgroundColor: "#081b3a", minHeight: "100vh", padding: 30 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              backgroundColor: "#1F3C88",
              borderRadius: 12,
              padding: "16px 18px",
              color: "#FFFFFF",
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>
                Perfil <span style={{ color: "#27AE60" }}>da ONG</span>
              </h1>
              <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
                Perfil não encontrado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                backgroundColor: "transparent",
                border: "1px solid rgba(255,255,255,0.4)",
                color: "#FFFFFF",
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh" }}>
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

        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            backgroundColor: "transparent",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#FFFFFF",
            padding: "8px 12px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          ← Voltar
        </button>
      </div>

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
          <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Perfil público da ONG</h1>

          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E0E6F1",
              padding: 16,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
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

              <div style={{ flex: 1, minWidth: 260 }}>
                <h2 style={{ margin: 0, color: "#2C3E50" }}>
                  {profile.organizationName || "Nome da ONG"}{" "}
                  <span style={{ color: "#27AE60" }}>✔</span>
                </h2>

                <div style={{ marginTop: 6, color: "#4F5D75", fontWeight: 700 }}>
                  Responsável: {org?.name || "Não informado"}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {/* ✅ EMAIL DA ONG */}
                  <InfoRow label="Email" value={org?.email || "Não informado"} />

                  <InfoRow label="Telefone" value={profile.phone || "Não informado"} />
                  <InfoRow label="Site" value={profile.website || "Não informado"} />
                  <InfoRow label="Endereço" value={profile.address || "Não informado"} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#6C757D", fontSize: 12, fontWeight: 800 }}>Descrição</div>
                  <div style={{ color: "#4F5D75", marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                    {profile.description && String(profile.description).trim()
                      ? profile.description
                      : "Não informado"}
                  </div>
                </div>
              </div>
            </div>
          </div>

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
            <strong style={{ color: "#2C3E50" }}>Observação:</strong> este é um perfil apenas para visualização.
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