import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";

export default function StudentActivityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/activities/${id}`);
        setActivity(res.data);
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar detalhes da atividade");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <p>Carregando...</p>;
  if (!activity) return <p>Atividade não encontrada.</p>;

  const orgName = activity?.createdBy?.name || "ONG";
  const dateStr = activity?.date ? new Date(activity.date).toLocaleDateString() : "-";

  return (
    <div style={{ backgroundColor: "#F2F5FA", minHeight: "100vh", padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Detalhes da atividade</h1>

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

      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E0E6F1",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#2C3E50" }}>{activity.title}</h2>

        <div style={{ color: "#4F5D75", marginTop: 6 }}>
          <strong>ONG:</strong>{" "}
          <span style={{ color: "#2E5AAC", fontWeight: 700 }}>{orgName}</span>
          <span style={{ color: "#6C757D" }}> (clicável depois)</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ color: "#6C757D", fontSize: 12 }}>Data</div>
            <div style={{ fontWeight: 700, color: "#2C3E50" }}>{dateStr}</div>
          </div>

          <div>
            <div style={{ color: "#6C757D", fontSize: 12 }}>Horário</div>
            <div style={{ fontWeight: 700, color: "#2C3E50" }}>
              {activity.startTime || "-"} — {activity.endTime || "-"}
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ color: "#6C757D", fontSize: 12 }}>Local</div>
            <div style={{ fontWeight: 700, color: "#2C3E50" }}>{activity.location || "-"}</div>
          </div>

          <div>
            <div style={{ color: "#6C757D", fontSize: 12 }}>Carga horária</div>
            <div style={{ fontWeight: 700, color: "#2C3E50" }}>{activity.workloadHours ?? "-"}h</div>
          </div>

          <div>
            <div style={{ color: "#6C757D", fontSize: 12 }}>Vagas</div>
            <div style={{ fontWeight: 700, color: "#2C3E50" }}>
              mín {activity.minParticipants ?? "-"} / máx {activity.maxParticipants ?? "-"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#6C757D", fontSize: 12 }}>Descrição</div>
          <p style={{ margin: "6px 0 0", color: "#4F5D75", lineHeight: 1.5 }}>
            {activity.description || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
