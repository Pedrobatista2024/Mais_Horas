import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import BackButton from "../../components/ui/BackButton";
import PageHeader from "../../components/ui/PageHeader";
import ActivityForm from "../../components/forms/ActivityForm";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

export default function EditActivity() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState(null);
  const [hasParticipants, setHasParticipants] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/activities/${id}`);
        setHasParticipants((data.participants || []).length > 0);
        setInitial({
          title: data.title || "",
          location: data.location || "",
          date: data.date ? new Date(data.date) : null,
          startTime: data.startTime || "",
          endTime: data.endTime || "",
          workloadHours: data.workloadHours || "",
          minParticipants: data.minParticipants ?? 1,
          maxParticipants: data.maxParticipants ?? 20,
          description: data.description || "",
        });
      } catch (err) {
        notifyError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      await api.put(`/activities/${id}`, payload);
      notifySuccess("Atividade atualizada!");
      navigate(`/org/activity/${id}`);
    } catch (err) {
      notifyError(err, "Erro ao atualizar atividade");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <BackButton onClick={() => navigate(-1)} />
      <PageHeader eyebrow="Gestão de vaga" title="Editar atividade" />
      <ActivityForm
        initialValues={initial}
        onSubmit={handleSubmit}
        submitLabel="Salvar alterações"
        loading={saving}
        lockedExceptLimits={hasParticipants}
        onCancel={() => navigate(`/org/activity/${id}`)}
      />
    </>
  );
}
