import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function MyActivities() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMyActivities() {
      try {
        // ⚠️ Se sua rota for diferente, troque aqui:
        const response = await api.get("/participations/my");
        setItems(response.data || []);
      } catch (error) {
        console.error(error);
        alert(
          error.response?.data?.message ||
            "Erro ao carregar suas atividades (verifique a rota do backend)."
        );
      } finally {
        setLoading(false);
      }
    }
    loadMyActivities();
  }, []);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const normalized = useMemo(() => {
    return (items || [])
      .map((p) => {
        const a = p.activity || {};
        const d = a.date ? new Date(a.date) : null;
        const activityDate = d && !Number.isNaN(d.getTime()) ? d : null;
        if (activityDate) activityDate.setHours(0, 0, 0, 0);

        const isFinishedByStatus = a.status === "finished";
        const isPast = activityDate ? activityDate < today : false;

        const isFinished = isFinishedByStatus || isPast;

        return {
          participationId: p._id,
          participationStatus: p.status || "pending", // pending | present | absent
          activity: a,
          isFinished,
        };
      })
      .filter((x) => x.activity?._id);
  }, [items, today]);

  const pendingActivities = useMemo(
    () => normalized.filter((x) => !x.isFinished),
    [normalized]
  );

  const finishedActivities = useMemo(
    () => normalized.filter((x) => x.isFinished),
    [normalized]
  );

  function StatusBadge({ status }) {
    const map = {
      present: { label: "Presente", bg: "#E7F7EE", color: "#1F7A3A" },
      absent: { label: "Ausente", bg: "#FDECEC", color: "#B42318" },
      pending: { label: "Pendente", bg: "#FFF4E5", color: "#B26A00" },
    };
    const s = map[status] || map.pending;

    return (
      <span
        style={{
          padding: "3px 10px",
          borderRadius: 999,
          fontSize: 12,
          backgroundColor: s.bg,
          color: s.color,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {s.label}
      </span>
    );
  }

  function ActivityCard({ item, showPresence }) {
    const a = item.activity || {};
    const dateStr = a.date ? new Date(a.date).toLocaleDateString() : "-";

    return (
      <button
        type="button"
        onClick={() => navigate(`/student/activity/${a._id}`)}
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
            <div style={{ fontWeight: 800, color: "#2C3E50" }}>{a.title}</div>
            <div style={{ fontSize: 13, color: "#4F5D75", marginTop: 4 }}>
              {a.location || "-"} • {dateStr}
            </div>
            <div style={{ fontSize: 13, color: "#4F5D75", marginTop: 2 }}>
              {a.startTime || "-"} — {a.endTime || "-"} • {a.workloadHours ?? "-"}h
            </div>
          </div>

          {showPresence && <StatusBadge status={item.participationStatus} />}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#2E5AAC", fontWeight: 700 }}>
          Ver detalhes →
        </div>
      </button>
    );
  }

  if (loading) return <p>Carregando...</p>;

  return (
    <div style={{ backgroundColor: "#F2F5FA", minHeight: "100vh", padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Minhas Atividades</h1>

        <button
          onClick={() => navigate(-1)}
          style={{
            backgroundColor: "#2E5AAC",
            border: "none",
            padding: "8px 14px",
            color: "#FFFFFF",
            cursor: "pointer",
            borderRadius: 10,
            fontWeight: 700,
          }}
        >
          Voltar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* PENDENTES */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, border: "1px solid #E0E6F1", padding: 16 }}>
          <h2 style={{ marginTop: 0, color: "#1F3C88" }}>Atividades pendentes</h2>

          {pendingActivities.length === 0 ? (
            <p style={{ color: "#4F5D75" }}>Você não tem atividades pendentes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingActivities.map((item) => (
                <ActivityCard key={item.participationId} item={item} showPresence={false} />
              ))}
            </div>
          )}
        </div>

        {/* FINALIZADAS */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, border: "1px solid #E0E6F1", padding: 16 }}>
          <h2 style={{ marginTop: 0, color: "#1F3C88" }}>Atividades finalizadas</h2>

          {finishedActivities.length === 0 ? (
            <p style={{ color: "#4F5D75" }}>Você ainda não finalizou atividades.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {finishedActivities.map((item) => (
                <ActivityCard key={item.participationId} item={item} showPresence={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
