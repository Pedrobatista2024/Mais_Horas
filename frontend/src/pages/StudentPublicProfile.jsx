import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

export default function StudentPublicProfile() {
  const navigate = useNavigate();
  const params = useParams();

  const studentId = params.studentId || params.id; // ✅ aceita os 2 formatos

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);

  async function loadPublicProfile() {
    try {
      // GET /users/student/:studentId/public
      const response = await api.get(`/users/student/${studentId}/public`);
      setStudent(response.data?.user || null); // ✅ agora bate com o backend (user)
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar perfil público do aluno");
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      setStudent(null);
      return;
    }
    loadPublicProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const profile = student?.studentProfile || {};

  const photoSrc = useMemo(() => {
    if (profile?.photo) {
      const normalized = String(profile.photo).replace(/\\/g, "/");
      if (normalized.startsWith("http")) return normalized;
      return `${API_BASE_URL}/${normalized}`;
    }

    if (profile?.photoUrl) return profile.photoUrl;

    return "";
  }, [profile?.photo, profile?.photoUrl]);

  const locationText =
    profile.city && profile.state
      ? `${profile.city} - ${profile.state}`
      : profile.city || profile.state || "";

  if (loading) {
    return <p style={{ padding: 20, color: "#fff" }}>Carregando...</p>;
  }

  if (!student) {
    return (
      <div style={{ backgroundColor: "#081b3a", minHeight: "100vh", padding: 30 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ color: "#fff" }}>Perfil não encontrado</h1>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#2E5AAC",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh" }}>
      {/* HEADER */}
      <div
        style={{
          backgroundColor: "#1F3C88",
          color: "#FFFFFF",
          padding: "15px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Mais<span style={{ color: "#27AE60" }}>Horas</span>
        </h2>

        <button
          onClick={() => navigate(-1)}
          style={{
            backgroundColor: "transparent",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#FFFFFF",
            padding: "8px 12px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          ← Voltar
        </button>
      </div>

      {/* CONTEÚDO */}
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
          <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Perfil público do aluno</h1>

          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E0E6F1",
              padding: 16,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
            }}
          >
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {/* FOTO */}
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  backgroundColor: "#c8d5ed",
                  border: "4px solid #fff",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt="Foto do aluno"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ color: "#1F3C88", fontWeight: 900 }}>Foto</span>
                )}
              </div>

              {/* DADOS */}
              <div style={{ flex: 1, minWidth: 260 }}>
                <h2 style={{ margin: 0, color: "#2C3E50" }}>{profile.fullName || student.name}</h2>

                {locationText && (
                  <p style={{ margin: "6px 0 0", color: "#4F5D75", fontWeight: 700 }}>
                    {locationText}
                  </p>
                )}

                {/* ✅ EMAIL DO ALUNO */}
                <div style={{ marginTop: 10 }}>
                  <InfoRow label="Email" value={student.email || "Não informado"} />
                  <InfoRow label="Instituição" value={profile.institution || "Não informado"} />
                  <InfoRow label="Curso" value={profile.courseName || "Não informado"} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#6C757D", fontSize: 12, fontWeight: 800 }}>Sobre mim</div>
                  <div
                    style={{
                      color: "#4F5D75",
                      marginTop: 6,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.45,
                    }}
                  >
                    {profile.aboutMe && String(profile.aboutMe).trim() ? profile.aboutMe : "Não informado"}
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
        marginTop: 6,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E0E6F1",
        borderRadius: 10,
        padding: 10,
      }}
    >
      <div style={{ color: "#6C757D", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: "#2C3E50", fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}