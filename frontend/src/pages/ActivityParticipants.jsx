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
      setParticipants(prev =>
        prev.map(p =>
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

  return (
    <div>
      <h1>Participantes</h1>
      <p>Total: {participants.length}</p>

      {participants.length === 0 ? (
        <p>Nenhum participante inscrito ainda.</p>
      ) : (
        <ul>
          {participants.map((p) => (
            <li key={p._id} style={{ marginBottom: "10px" }}>
              <strong>{p.user.name}</strong> — {p.user.email}
              <br />

              {p.status === "pending" && (
                <>
                  <button
                    onClick={() => handleValidate(p._id, "present")}
                    style={{ marginRight: "8px" }}
                  >
                    Confirmar
                  </button>
                  <button onClick={() => handleValidate(p._id, "absent")}>
                    Ausente
                  </button>
                </>
              )}

              {p.status === "present" && <span>✔ Presente</span>}
              {p.status === "absent" && <span>✖ Ausente</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
