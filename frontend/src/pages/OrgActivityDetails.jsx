import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function OrgActivityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🆕 estado para mensagens de erro (regra de presença)
  const [errorMessage, setErrorMessage] = useState("");

  async function loadActivity() {
    try {
      const response = await api.get(`/activities/${id}`);
      setActivity(response.data);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar detalhes da atividade");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirma = confirm("Tem certeza que deseja excluir esta atividade?");
    if (!confirma) return;

    try {
      await api.delete(`/activities/${id}`);
      alert("Atividade excluída com sucesso!");
      navigate("/org");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir atividade");
    }
  }

  // 🔥 FINALIZAR ATIVIDADE (com regra de presença)
  async function handleFinishActivity() {
    setErrorMessage("");

    const confirma = confirm(
      "Ao finalizar a atividade, ela será encerrada e os certificados serão gerados para os alunos presentes. Deseja continuar?"
    );
    if (!confirma) return;

    try {
      await api.post(`/activities/${id}/finish`);
      alert("Atividade finalizada com sucesso!");
      loadActivity(); // atualiza status
    } catch (error) {
      console.error(error);

      const message =
        error.response?.data?.message || "Erro ao finalizar atividade";

      setErrorMessage(message);
    }
  }

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateStr = useMemo(() => {
    if (!activity?.date) return "-";
    const d = new Date(activity.date);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  }, [activity]);

  const isFinished = activity?.status === "finished";

  const statusUi = useMemo(() => {
    const s = activity?.status;
    if (s === "finished") return { label: "FINALIZADA", bg: "#EEF2FF", color: "#1F3C88" };
    if (s === "active") return { label: "ATIVA", bg: "#E7F7EE", color: "#1F7A3A" };
    if (s === "canceled") return { label: "CANCELADA", bg: "#FDECEC", color: "#B42318" };
    return { label: String(s || "STATUS"), bg: "#FFF4E5", color: "#B26A00" };
  }, [activity]);

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando dados...</p>;
  if (!activity) return <p style={{ padding: 20, color: "#fff" }}>Atividade não encontrada.</p>;

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
            type="button"
            onClick={() => navigate(-1)}
            style={navBtnOutline}
          >
            ← Voltar
          </button>

          <button
            type="button"
            onClick={() => navigate("/org")}
            style={navBtnPrimary}
          >
            Painel
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, padding: "0 16px" }}>
        <div style={{ maxWidth: 980, width: "100%" }}>
          {/* Header do Card */}
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
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 22, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activity.title}
              </h1>
              <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
                Gerencie detalhes, participantes e finalização.
              </p>
            </div>

            <span
              style={{
                height: 28,
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                color: statusUi.color,
                backgroundColor: statusUi.bg,
                whiteSpace: "nowrap",
              }}
            >
              {statusUi.label}
            </span>
          </div>

          {/* Corpo */}
          <div
            style={{
              marginTop: 16,
              backgroundColor: "#a1aac9",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
            }}
          >
            {/* Infos principais */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <InfoBox label="Local" value={activity.location || "-"} />
              <InfoBox label="Data" value={dateStr} />
              <InfoBox
                label="Horário"
                value={`${activity.startTime || "-"} — ${activity.endTime || "-"}`}
              />
              <InfoBox
                label="Carga horária"
                value={`${activity.workloadHours ?? "-"} horas`}
              />
              <InfoBox
                label="Vagas"
                value={`mín ${activity.minParticipants ?? "-"} / máx ${activity.maxParticipants ?? "-"}`}
              />
            </div>

            {/* Descrição */}
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#1F3C88", fontWeight: 900, marginBottom: 6 }}>Descrição</div>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E0E6F1",
                  borderRadius: 12,
                  padding: 14,
                  color: "#2C3E50",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                }}
              >
                {activity.description || "—"}
              </div>
            </div>

            {/* 🆕 Mensagem clara de erro (regra de presença) */}
            {errorMessage && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  backgroundColor: "#FDECEC",
                  color: "#B42318",
                  border: "1px solid #F5C6CB",
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Ações */}
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate(`/org/activity/${id}/participants`)}
                style={btnPrimary}
              >
                Ver participantes
              </button>

              {!isFinished && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`/org/activity/${id}/edit`)}
                    style={btnSecondary}
                  >
                    Editar atividade
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishActivity}
                    style={btnSuccess}
                  >
                    Finalizar atividade
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    style={btnDanger}
                  >
                    Excluir atividade
                  </button>
                </>
              )}

              <button type="button" onClick={() => navigate(-1)} style={btnGhost}>
                Voltar
              </button>
            </div>

            {isFinished && (
              <div style={{ marginTop: 10, color: "#4F5D75", fontWeight: 700, fontSize: 13 }}>
                Essa atividade já está finalizada. Editar/Excluir/Finalizar ficam indisponíveis.
              </div>
            )}
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
      }}
    >
      <div style={{ color: "#6C757D", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, color: "#2C3E50", fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const navBtnOutline = {
  backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.4)",
  color: "#FFFFFF",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const navBtnPrimary = {
  backgroundColor: "#2E5AAC",
  border: "none",
  padding: "8px 12px",
  color: "#FFFFFF",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const btnPrimary = {
  backgroundColor: "#2E5AAC",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnSecondary = {
  backgroundColor: "#5C677D",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnSuccess = {
  backgroundColor: "#27AE60",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnDanger = {
  backgroundColor: "#EB5757",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnGhost = {
  backgroundColor: "#F7F9FC",
  color: "#2C3E50",
  border: "1px solid #E0E6F1",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};
