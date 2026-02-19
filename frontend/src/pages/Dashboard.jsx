import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

export default function Dashboard() {
  const navigate = useNavigate();

  const [certificates, setCertificates] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  // ✅ métricas reais (baseadas em participations)
  const [volunteerActivities, setVolunteerActivities] = useState(0);
  const [hoursContributed, setHoursContributed] = useState(0);

  // ✅ dados do perfil do aluno
  const [profile, setProfile] = useState({
    name: "Nome do Aluno",
    aboutMe: "—",
    city: "",
    state: "",
    photoSrc: "",
  });

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  async function loadCertificates() {
    try {
      const response = await api.get("/certificates/my");
      setCertificates(response.data || []);
    } catch (error) {
      console.error(error);
      setCertificates([]);
    } finally {
      setLoadingCerts(false);
    }
  }

  // ✅ carrega participações e calcula métricas
  async function loadStatsFromMyActivities() {
    try {
      const response = await api.get("/participations/my");
      const items = response.data || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const finishedAndPresent = items.filter((p) => {
        const statusOk = p?.status === "present";

        const a = p?.activity;
        if (!a?._id) return false;

        const finishedByStatus = a.status === "finished";

        let finishedByDate = false;
        if (a.date) {
          const d = new Date(a.date);
          if (!Number.isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            finishedByDate = d < today;
          }
        }

        const finishedOk = finishedByStatus || finishedByDate;
        return statusOk && finishedOk;
      });

      const totalActivities = finishedAndPresent.length;

      const totalHours = finishedAndPresent.reduce((sum, p) => {
        const h = Number(p?.activity?.workloadHours || 0);
        return sum + (Number.isFinite(h) ? h : 0);
      }, 0);

      setVolunteerActivities(totalActivities);
      setHoursContributed(totalHours);
    } catch (error) {
      console.error(error);
      setVolunteerActivities(0);
      setHoursContributed(0);
    }
  }

  // ✅ carrega dados do perfil do aluno (nome, sobre mim, cidade/estado e foto)
  async function loadStudentProfile() {
    try {
      const response = await api.get("/users/profile");
      const user = response.data?.user || {};
      const sp = user.studentProfile || {};

      const displayName = sp.fullName || user.name || "Nome do Aluno";
      const aboutMe = sp.aboutMe && String(sp.aboutMe).trim() ? sp.aboutMe : "—";
      const city = sp.city || "";
      const state = sp.state || "";

      // prioridade: upload (photo) -> url (photoUrl) -> vazio
      let photoSrc = "";
      if (sp.photo) {
        photoSrc = `${API_BASE_URL}/${String(sp.photo).replace(/\\/g, "/")}`;
      } else if (sp.photoUrl) {
        photoSrc = sp.photoUrl;
      }

      setProfile({
        name: displayName,
        aboutMe,
        city,
        state,
        photoSrc,
      });
    } catch (error) {
      console.error(error);
      // não trava a página
    }
  }

  // ✅ BLOQUEIO simples no clique do botão "Buscar Atividades"
  async function handleGoToActivities() {
    try {
      const response = await api.get("/users/profile");
      const user = response.data?.user || {};
      const sp = user.studentProfile || {};

      const requiredFields = [
        sp.fullName || user.name, // nome
        sp.sex,
        sp.birthDate,
        user.email,
        sp.phone,
        sp.city,
        sp.state,
        sp.institution,
        sp.courseName,
        sp.aboutMe,
      ];

      const allFilled = requiredFields.every((field) => String(field ?? "").trim() !== "");
      const hasUploadPhoto = !!sp.photo; // foto (upload) obrigatória

      if (!allFilled || !hasUploadPhoto) {
        alert("⚠️ Você precisa completar seu perfil (incluindo foto) antes de buscar atividades.");
        return;
      }

      navigate("/activities");
    } catch (error) {
      console.error(error);
      alert("Erro ao verificar perfil.");
    }
  }

  useEffect(() => {
    loadCertificates();
    loadStatsFromMyActivities();
    loadStudentProfile();
  }, []);

  const lastThreeCertificates = useMemo(() => {
    const sorted = [...(certificates || [])].sort((a, b) => {
      const da = a?.activity?.date ? new Date(a.activity.date).getTime() : 0;
      const db = b?.activity?.date ? new Date(b.activity.date).getTime() : 0;
      return db - da; // mais recente primeiro
    });

    return sorted.slice(0, 3);
  }, [certificates]);

  const locationText =
    profile.city && profile.state ? `${profile.city} - ${profile.state}` : profile.city || profile.state || "";

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
              cursor: "pointer",
            }}
            onClick={handleGoToActivities}
          >
            Buscar Atividades
          </button>

          <button
            style={{
              backgroundColor: "#2E5AAC",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer",
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
              cursor: "pointer",
            }}
            onClick={() => navigate("/edit-student-profile")}
          >
            Editar Perfil
          </button>

          <button
            style={{
              backgroundColor: "#EB5757",
              border: "none",
              padding: "8px 14px",
              color: "#FFFFFF",
              cursor: "pointer",
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
            boxShadow: "0 6px 18px rgba(31, 60, 136, 0.08)",
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
                marginTop: -70,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Foto do aluno"
            >
              {profile.photoSrc ? (
                <img
                  src={profile.photoSrc}
                  alt="Foto do aluno"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ color: "#1F3C88", fontWeight: 900 }}>Foto</span>
              )}
            </div>

            <div>
              <h2 style={{ margin: 0, color: "#2C3E50" }}>
                {profile.name} <span style={{ color: "#27AE60" }}>✔</span>
              </h2>

              {locationText && (
                <p style={{ margin: "6px 0 0", color: "#4F5D75", fontWeight: 700 }}>{locationText}</p>
              )}
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
              padding: "20px 0",
            }}
          >
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88", margin: 0 }}>{volunteerActivities}</h3>
              <p style={{ color: "#2C3E50" }}>Atividades Voluntárias</p>
            </div>

            <div style={{ flex: 1, borderLeft: "1px solid #E0E6F1", borderRight: "1px solid #E0E6F1" }}>
              <h3 style={{ color: "#1F3C88", margin: 0 }}>{hoursContributed}</h3>
              <p style={{ color: "#2C3E50" }}>Horas Contribuídas</p>
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88", margin: 0 }}>{certificates?.length || 0}</h3>
              <p style={{ color: "#2C3E50" }}>Certificados Obtidos</p>
            </div>
          </div>

          {/* ===== CONTEÚDO INFERIOR ===== */}
          <div style={{ display: "flex", gap: 30, marginTop: 30 }}>
            {/* SOBRE MIM */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#1F3C88" }}>Sobre Mim</h3>
              <p style={{ color: "#4F5D75", whiteSpace: "pre-wrap" }}>{profile.aboutMe || "—"}</p>
            </div>

            {/* CERTIFICADOS */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ color: "#1F3C88", margin: 0 }}>Certificados Obtidos</h3>

                <button
                  type="button"
                  onClick={() => navigate("/my-certificates")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#2E5AAC",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontWeight: 700,
                  }}
                >
                  Ver todos
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                {loadingCerts ? (
                  <p style={{ color: "#4F5D75" }}>Carregando...</p>
                ) : lastThreeCertificates.length === 0 ? (
                  <p style={{ color: "#4F5D75" }}>Você ainda não possui certificados.</p>
                ) : (
                  lastThreeCertificates.map((cert) => (
                    <div
                      key={cert._id}
                      style={{
                        backgroundColor: "#F7F9FC",
                        padding: 15,
                        borderRadius: 8,
                        marginBottom: 10,
                        border: "1px solid #E0E6F1",
                      }}
                    >
                      <span style={{ color: "#F2C94C" }}>🏅</span>{" "}
                      <span style={{ color: "#2C3E50", fontWeight: 800 }}>
                        {cert?.activity?.title || "Atividade"}
                      </span>
                      <br />
                      <small style={{ color: "#6C757D" }}>
                        {cert?.activity?.date ? new Date(cert.activity.date).toLocaleDateString() : "Data"}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
