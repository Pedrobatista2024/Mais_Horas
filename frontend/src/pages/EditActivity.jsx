import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function EditActivity() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [participantsCount, setParticipantsCount] = useState(0);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      try {
        const response = await api.get(`/activities/${id}`);
        console.log("RESPOSTA DA API:", response.data);
        console.log("LISTA DE PARTICIPANTES:", response.data.participants);
        const activity = response.data;

        const inscritos = activity.participants?.length || 0;
        setParticipantsCount(inscritos);

        setForm({
          title: activity.title,
          description: activity.description,
          location: activity.location,
          date: activity.date?.substring(0, 10),
          startTime: activity.startTime,
          endTime: activity.endTime,
          workloadHours: activity.workloadHours,
          minParticipants: activity.minParticipants,
          maxParticipants: activity.maxParticipants
        });
      } catch (error) {
        alert("Erro ao carregar atividade");
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [id]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    let payload = {};

    if (participantsCount > 0) {
      if (Number(form.maxParticipants) < participantsCount) {
        alert(`O máximo não pode ser menor que ${participantsCount}`);
        return;
      }

      payload = {
        minParticipants: form.minParticipants,
        maxParticipants: form.maxParticipants
      };
    } else {
      payload = form;
    }

    try {
      await api.put(`/activities/${id}`, payload);
      alert("Atividade atualizada com sucesso!");
      navigate(`/org/activity/${id}`);
    } catch (error) {
      alert(error.response?.data?.message || "Erro ao atualizar atividade");
    }
  }

  if (loading) return <p>Carregando...</p>;
  if (!form) return <p>Atividade não encontrada.</p>;

  const hasParticipants = participantsCount > 0;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Editar atividade</h1>

      
      {hasParticipants && (
        <p style={{ color: "orange" }}>
          {participantsCount === 1 
            ? `Existe ${participantsCount} aluno inscrito.` 
            : `Existem ${participantsCount} alunos inscritos.`}
          Apenas mínimo,máximo e as horas podem ser alterados.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, width: 350 }}>

        {!hasParticipants && (
          <>
            <p>Título</p>
            <input name="title" value={form.title} onChange={handleChange} />
            <p>Descrição</p>
            <textarea name="description" value={form.description} onChange={handleChange} />
            <p>Data</p>
            <input type="date" name="date" value={form.date} onChange={handleChange} />
            <p>Localização</p>
            <input name="location" value={form.location} onChange={handleChange} />
            <p>Hora Inicio</p>
            <input type="time" name="startTime" value={form.startTime} onChange={handleChange} />
            <p>Hora Fim</p>
            <input type="time" name="endTime" value={form.endTime} onChange={handleChange} />
            <p>Carga Horaria</p>
            <input type="number" name="workloadHours" value={form.workloadHours} onChange={handleChange} />
          </>
        )}
        <p>Minimo</p>
        <input
          type="number"
          name="minParticipants"
          value={form.minParticipants}
          onChange={handleChange}
        />
        <p>Maximo</p>
        <input
          type="number"
          name="maxParticipants"
          value={form.maxParticipants}
          onChange={handleChange}
        />
        

        <button type="submit">Salvar alterações</button>
        <button type="button" onClick={() => navigate(`/org/activity/${id}`)}>Cancelar</button>
      </form>
    </div>
  );
}
