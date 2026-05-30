import { useState } from "react";
import { useNavigate } from "react-router-dom";

import BackButton from "../../components/ui/BackButton";
import PageHeader from "../../components/ui/PageHeader";
import ActivityForm from "../../components/forms/ActivityForm";
import { api } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

export default function CreateActivity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(payload) {
    setLoading(true);
    try {
      await api.post("/activities", payload);
      notifySuccess("Atividade criada com sucesso!");
      navigate("/org/my-activities");
    } catch (err) {
      notifyError(err, "Erro ao criar atividade");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BackButton onClick={() => navigate(-1)} />
      <PageHeader
        eyebrow="Publicação"
        title="Nova atividade"
        subtitle="Publique uma vaga de voluntariado para os estudantes."
      />
      <ActivityForm
        onSubmit={handleSubmit}
        submitLabel="Criar atividade"
        loading={loading}
        onCancel={() => navigate("/org/my-activities")}
      />
    </>
  );
}
