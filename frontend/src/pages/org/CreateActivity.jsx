import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";

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
      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={18} />}
        onClick={() => navigate(-1)}
        mb="md"
      >
        Voltar
      </Button>
      <PageHeader title="Nova atividade" subtitle="Publique uma vaga de voluntariado para os estudantes." />
      <ActivityForm
        onSubmit={handleSubmit}
        submitLabel="Criar atividade"
        loading={loading}
        onCancel={() => navigate("/org/my-activities")}
      />
    </>
  );
}
