import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";

export default function ActivityParticipants() {
  const { id } = useParams(); // id da atividade
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadParticipants() {
    try {
      const response = await api.get(`/participations/activity/${id}`);

      // ordena por nome
      const sorted = response.data.sort((a, b) =>
        a.user.name.localeCompare(b.user.name)
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
        prev.map((p) =>
          p._id === participationId ? { ...p, status } : p
        )
      );
    } catch (error) {
      console.error(error);
      alert("Erro ao validar presença");
    }
  }

  useEffect(() => {
    loadParticipants();
  }, []);

  if (loading) {
    return <p>Carregando participantes...</p>;
  }

  const total = participants.length;
  const pendingCount = participants.filter(p => p.status === "pending").length;
  const presentCount = participants.filter(p => p.status === "present").length;
  const absentCount = participants.filter(p => p.status === "absent").length;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Participantes</h1>

      {/* 📊 RESUMO CLARO */}
      <div
        style={{
          marginBottom: "15px",
          padding: "10px",
          backgroundColor: "#1a0202",
          borderRadius: "6px"
        }}
      >
        <p><strong>Total:</strong> {total}</p>
        <p>🟡 Pendentes: {pendingCount}</p>
        <p>🟢 Presentes: {presentCount}</p>
        <p>🔴 Ausentes: {absentCount}</p>

        {pendingCount > 0 && (
          <p style={{ color: "#b26a00", marginTop: "8px" }}>
            ⚠️ É necessário responder a presença de todos os participantes
            antes de finalizar a atividade.
          </p>
        )}
      </div>

      {participants.length === 0 ? (
        <p>Nenhum participante inscrito ainda.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {participants.map((p) => (
            <li
              key={p._id}
              style={{
                marginBottom: "12px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "6px"
              }}
            >
              <strong>{p.user.name}</strong> — {p.user.email}
              <br />

              {/* 🟡 PENDENTE */}
              {p.status === "pending" && (
                <>
                  <span style={{ color: "#b26a00" }}>🟡 Pendente</span>
                  <br />
                  <button
                    onClick={() => handleValidate(p._id, "present")}
                    style={{ marginRight: "8px", marginTop: "6px" }}
                  >
                    Confirmar presença
                  </button>
                  <button
                    onClick={() => handleValidate(p._id, "absent")}
                    style={{ marginTop: "6px" }}
                  >
                    Marcar ausente
                  </button>
                </>
              )}

              {/* 🟢 PRESENTE */}
              {p.status === "present" && (
                <span style={{ color: "#2e7d32" }}>🟢 Presente</span>
              )}

              {/* 🔴 AUSENTE */}
              {p.status === "absent" && (
                <span style={{ color: "#c62828" }}>🔴 Ausente</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
