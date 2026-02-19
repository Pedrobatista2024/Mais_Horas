import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function MyOrgActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function loadActivities() {
    try {
      const response = await api.get("/activities/my");
      setActivities(response.data || []);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar atividades");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  const pending = useMemo(
    () => (activities || []).filter((a) => a?.status !== "finished"),
    [activities]
  );
  const finished = useMemo(
    () => (activities || []).filter((a) => a?.status === "finished"),
    [activities]
  );

  function ActivityCard({ activity, variant }) {
    const dateStr = activity?.date
      ? new Date(activity.date).toLocaleDateString()
      : "-";

    const isFinished = variant === "finished";

    return (
      <button
        type="button"
        onClick={() => navigate(`/org/activity/${activity._id}`)}
        style={{
          width: "100%",
          textAlign: "left",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E0E6F1",
          borderRadius: 12,
          padding: 14,
          boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                color: "#2C3E50",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={activity?.title || "Atividade"}
            >
              {activity?.title || "Atividade"}
            </div>

            <div style={{ fontSize: 13, color: "#4F5D75", marginTop: 4 }}>
              {activity?.location || "-"} • {dateStr}
            </div>

            <div style={{ fontSize: 13, color: "#4F5D75", marginTop: 2 }}>
              {activity?.startTime || "-"} — {activity?.endTime || "-"} •{" "}
              {activity?.workloadHours ?? "-"}h
            </div>
          </div>

          <span
            style={{
              height: 24,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 900,
              color: isFinished ? "#1F3C88" : "#1F7A3A",
              backgroundColor: isFinished ? "#EEF2FF" : "#E7F7EE",
              whiteSpace: "nowrap",
              alignSelf: "flex-start",
            }}
          >
            {isFinished ? "FINALIZADA" : "PENDENTE"}
          </span>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#2E5AAC", fontWeight: 800 }}>
          Ver detalhes →
        </div>
      </button>
    );
  }

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando atividades...</p>;

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
            ← Voltar ao painel
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Minhas Atividades</h1>

            <div
              style={{
                backgroundColor: "#F7F9FC",
                border: "1px solid #E0E6F1",
                padding: "8px 12px",
                borderRadius: 999,
                fontWeight: 900,
                color: "#2C3E50",
                whiteSpace: "nowrap",
              }}
            >
              Total: {activities.length}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
              marginTop: 10,
            }}
          >
            {/* PENDENTES */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, border: "1px solid #E0E6F1", padding: 16 }}>
              <h2 style={{ marginTop: 0, color: "#1F3C88" }}>⏳ Atividades pendentes</h2>

              {pending.length === 0 ? (
                <p style={{ color: "#4F5D75" }}>Nenhuma atividade pendente.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pending.map((activity) => (
                    <ActivityCard key={activity._id} activity={activity} variant="pending" />
                  ))}
                </div>
              )}
            </div>

            {/* FINALIZADAS */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, border: "1px solid #E0E6F1", padding: 16 }}>
              <h2 style={{ marginTop: 0, color: "#1F3C88" }}>✅ Atividades finalizadas</h2>

              {finished.length === 0 ? (
                <p style={{ color: "#4F5D75" }}>Nenhuma atividade finalizada.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {finished.map((activity) => (
                    <ActivityCard key={activity._id} activity={activity} variant="finished" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
