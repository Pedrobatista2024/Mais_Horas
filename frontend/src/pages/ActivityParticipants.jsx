import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function ActivityParticipants() {
  const { id } = useParams(); // id da atividade
  const navigate = useNavigate();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadParticipants() {
    try {
      const response = await api.get(`/participations/activity/${id}`);

      // ordena por nome
      const sorted = (response.data || []).sort((a, b) =>
        (a?.user?.name || "").localeCompare(b?.user?.name || "")
      );

      setParticipants(sorted);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar participantes");
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate(participationId, status) {
    try {
      await api.put(`/participations/${participationId}/validate`, { status });

      // atualiza a UI sem reload
      setParticipants((prev) =>
        prev.map((p) => (p._id === participationId ? { ...p, status } : p))
      );
    } catch (error) {
      console.error(error);
      alert("Erro ao validar presença");
    }
  }

  useEffect(() => {
    loadParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = participants.length;
    const pendingCount = participants.filter((p) => p.status === "pending").length;
    const presentCount = participants.filter((p) => p.status === "present").length;
    const absentCount = participants.filter((p) => p.status === "absent").length;
    return { total, pendingCount, presentCount, absentCount };
  }, [participants]);

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando participantes...</p>;

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
          <button type="button" onClick={() => navigate(-1)} style={navBtnOutline}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, padding: "0 16px" }}>
        <div style={{ maxWidth: 980, width: "100%" }}>
          {/* Header */}
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
              <h1 style={{ margin: 0, fontSize: 22 }}>Participantes</h1>
              <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
                Confirme presença/ausência para liberar a finalização da atividade.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "8px 12px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Total: {stats.total}
            </div>
          </div>

          {/* Card */}
          <div
            style={{
              marginTop: 16,
              backgroundColor: "#a1aac9",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
            }}
          >
            {/* 📊 RESUMO */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <StatBox label="🟡 Pendentes" value={stats.pendingCount} bg="#FFF4E5" color="#B26A00" />
              <StatBox label="🟢 Presentes" value={stats.presentCount} bg="#E7F7EE" color="#1F7A3A" />
              <StatBox label="🔴 Ausentes" value={stats.absentCount} bg="#FDECEC" color="#B42318" />
            </div>

            {stats.pendingCount > 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  backgroundColor: "#FFF4E5",
                  border: "1px solid #FFD9A8",
                  color: "#7A4A00",
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                ⚠️ É necessário responder a presença de todos os participantes antes de finalizar a atividade.
              </div>
            )}

            {participants.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#F7F9FC",
                  border: "1px solid #E0E6F1",
                  borderRadius: 12,
                  padding: 16,
                  color: "#2C3E50",
                }}
              >
                <strong>Nenhum participante inscrito ainda.</strong>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {participants.map((p) => {
                  const name = p?.user?.name || "Aluno";
                  const email = p?.user?.email || "-";

                  return (
                    <div
                      key={p._id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E0E6F1",
                        borderRadius: 12,
                        padding: 14,
                        boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 240 }}>
                        <div style={{ fontWeight: 900, color: "#2C3E50" }}>{name}</div>
                        <div style={{ marginTop: 4, color: "#4F5D75", fontSize: 13 }}>{email}</div>

                        <div style={{ marginTop: 10 }}>
                          <StatusBadge status={p.status || "pending"} />
                        </div>
                      </div>

                      {/* Ações */}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {p.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleValidate(p._id, "present")}
                              style={btnSuccess}
                            >
                              Confirmar presença
                            </button>
                            <button
                              type="button"
                              onClick={() => handleValidate(p._id, "absent")}
                              style={btnDanger}
                            >
                              Marcar ausente
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleValidate(p._id, "present")}
                              style={{
                                ...btnGhost,
                                borderColor: p.status === "present" ? "#27AE60" : "rgba(46,90,172,0.35)",
                                color: p.status === "present" ? "#1F7A3A" : "#2E5AAC",
                                backgroundColor: p.status === "present" ? "#E7F7EE" : "transparent",
                              }}
                            >
                              Presente
                            </button>

                            <button
                              type="button"
                              onClick={() => handleValidate(p._id, "absent")}
                              style={{
                                ...btnGhost,
                                borderColor: p.status === "absent" ? "#EB5757" : "rgba(46,90,172,0.35)",
                                color: p.status === "absent" ? "#B42318" : "#2E5AAC",
                                backgroundColor: p.status === "absent" ? "#FDECEC" : "transparent",
                              }}
                            >
                              Ausente
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ height: 28 }} />
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, bg, color }) {
  return (
    <div
      style={{
        backgroundColor: bg,
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#2C3E50" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    present: { label: "🟢 Presente", bg: "#E7F7EE", color: "#1F7A3A" },
    absent: { label: "🔴 Ausente", bg: "#FDECEC", color: "#B42318" },
    pending: { label: "🟡 Pendente", bg: "#FFF4E5", color: "#B26A00" },
  };
  const s = map[status] || map.pending;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        backgroundColor: s.bg,
        color: s.color,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
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

const btnSuccess = {
  backgroundColor: "#27AE60",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 12px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnDanger = {
  backgroundColor: "#EB5757",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 12px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const btnGhost = {
  backgroundColor: "transparent",
  border: "1px solid rgba(46,90,172,0.35)",
  padding: "10px 12px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};
