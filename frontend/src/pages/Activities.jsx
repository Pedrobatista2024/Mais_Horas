import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // ✅ Inicializado aqui corretamente

  useEffect(() => {
    async function loadActivities() {
      try {
        const response = await api.get("/activities");
        setActivities(response.data);
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar atividades");
      } finally {
        setLoading(false);
      }
    }
    loadActivities();
  }, []);

  async function handleParticipate(activityId) {
    try {
      await api.post(`/activities/${activityId}/join`);
      alert("Inscrição realizada com sucesso!");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Erro ao realizar inscrição");
    }
  }

  // ✅ Agora abre o perfil público da ONG
  function handleOpenOrgProfile(orgId) {
    if (!orgId) return;
    navigate(`/org/${orgId}/public`);
  }

  if (loading) return <p>Carregando atividades...</p>;

  // ✅ FILTRO: só mostra atividades ATIVAS e cuja data NÃO passou
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visibleActivities = activities.filter((activity) => {
    // 1) status: não pode ser finished/cancelled (aqui só aceitamos active)
    if (activity?.status !== "active") return false;

    // 2) data: não pode ter passado
    if (!activity?.date) return false;

    const activityDate = new Date(activity.date);
    if (Number.isNaN(activityDate.getTime())) return false;

    activityDate.setHours(0, 0, 0, 0);

    return activityDate >= today; // hoje ou futura
  });

  return (
    <div style={{ backgroundColor: "#F2F5FA", minHeight: "100vh", padding: 30 }}>
      <h1 style={{ marginTop: 0, color: "#1F3C88" }}>Buscar Atividades</h1>

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
          marginBottom: 20, // Adicionado um pequeno espaçamento para não colar no grid
        }}
      >
        Voltar
      </button>

      {visibleActivities.length === 0 ? (
        <p style={{ color: "#2C3E50" }}>Nenhuma atividade cadastrada</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 16,
          }}
        >
          {visibleActivities.map((activity) => {
            const orgName = activity?.createdBy?.name || "ONG";
            const orgId = activity?.createdBy?._id || activity?.createdBy; // ✅ suporta populate OU string

            const dateStr = activity?.date
              ? new Date(activity.date).toLocaleDateString()
              : "-";

            // aqui sempre vai ser active (por causa do filtro)
            const canJoin = true;

            const statusLabel = "ATIVA";
            const statusColor = "#27AE60";

            return (
              <div
                key={activity._id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid #E0E6F1",
                  boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, color: "#2C3E50", fontSize: 18 }}>
                      {activity.title}
                    </h2>

                    <div style={{ marginTop: 6, fontSize: 13, color: "#4F5D75" }}>
                      ONG:{" "}
                      <button
                        type="button"
                        onClick={() => handleOpenOrgProfile(orgId)}
                        disabled={!orgId}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: "#2E5AAC",
                          cursor: orgId ? "pointer" : "not-allowed",
                          textDecoration: orgId ? "underline" : "none",
                          fontWeight: 600,
                        }}
                        title={orgId ? "Ver perfil público da ONG" : "ID da ONG não encontrado"}
                      >
                        {orgName}
                      </button>
                    </div>
                  </div>

                  <span
                    style={{
                      height: 24,
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      backgroundColor: statusColor,
                      alignSelf: "flex-start",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Info grid */}
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    fontSize: 13,
                    color: "#2C3E50",
                  }}
                >
                  <div>
                    <div style={{ color: "#6C757D", fontSize: 12 }}>Data</div>
                    <div style={{ fontWeight: 600 }}>{dateStr}</div>
                  </div>

                  <div>
                    <div style={{ color: "#6C757D", fontSize: 12 }}>Horário</div>
                    <div style={{ fontWeight: 600 }}>
                      {activity.startTime || "-"} — {activity.endTime || "-"}
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ color: "#6C757D", fontSize: 12 }}>Local</div>
                    <div style={{ fontWeight: 600 }}>{activity.location || "-"}</div>
                  </div>

                  <div>
                    <div style={{ color: "#6C757D", fontSize: 12 }}>Carga horária</div>
                    <div style={{ fontWeight: 600 }}>{activity.workloadHours ?? "-"}h</div>
                  </div>

                  <div>
                    <div style={{ color: "#6C757D", fontSize: 12 }}>Vagas</div>
                    <div style={{ fontWeight: 600 }}>
                      mín {activity.minParticipants ?? "-"} / máx {activity.maxParticipants ?? "-"}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#6C757D", fontSize: 12 }}>Descrição</div>
                  <p style={{ margin: "6px 0 0", color: "#4F5D75", fontSize: 13, lineHeight: 1.4 }}>
                    {activity.description || "—"}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleParticipate(activity._id)}
                    disabled={!canJoin}
                    style={{
                      flex: 1,
                      backgroundColor: canJoin ? "#F2994A" : "#C9D3E7",
                      border: "none",
                      padding: "10px 12px",
                      borderRadius: 10,
                      color: canJoin ? "#FFFFFF" : "#2C3E50",
                      cursor: canJoin ? "pointer" : "not-allowed",
                      fontWeight: 700,
                    }}
                  >
                    {canJoin ? "Participar" : "Indisponível"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}