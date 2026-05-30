import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Paper,
  Title,
  Text,
  Group,
  Button,
  SimpleGrid,
  Divider,
  Modal,
  Stack,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconUsers,
  IconEdit,
  IconCheck,
  IconTrash,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconHourglass,
} from "@tabler/icons-react";

import Loading from "../../components/ui/Loading";
import StatusBadge from "../../components/ui/StatusBadge";
import { useFetch } from "../../hooks/useFetch";
import { api } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";
import { formatDate } from "../../utils/format";

function Field({ icon: Icon, label, value }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Icon size={20} style={{ opacity: 0.5, marginTop: 2 }} />
      <div>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text fw={600}>{value}</Text>
      </div>
    </Group>
  );
}

export default function OrgActivityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: activity, loading, refetch } = useFetch(`/activities/${id}`);
  const [finishModal, finishHandlers] = useDisclosure(false);
  const [deleteModal, deleteHandlers] = useDisclosure(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!activity) return <Text>Atividade não encontrada.</Text>;

  const participantsCount = (activity.participants || []).length;
  const isActive = activity.status === "active";

  async function handleFinish() {
    setBusy(true);
    try {
      const { data } = await api.post(`/activities/${id}/finish`);
      notifySuccess(`Atividade finalizada! ${data.certificadosGerados} certificado(s) gerado(s).`);
      finishHandlers.close();
      refetch();
    } catch (err) {
      notifyError(err, "Erro ao finalizar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/activities/${id}`);
      notifySuccess("Atividade excluída.");
      navigate("/org/my-activities");
    } catch (err) {
      notifyError(err, "Erro ao excluir");
    } finally {
      setBusy(false);
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

      <Paper withBorder radius="md" p="xl">
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="lg">
          <Title order={2}>{activity.title}</Title>
          <StatusBadge status={activity.status} />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <Field icon={IconCalendar} label="Data" value={formatDate(activity.date)} />
          <Field
            icon={IconClock}
            label="Horário"
            value={`${activity.startTime || "-"} – ${activity.endTime || "-"}`}
          />
          <Field icon={IconMapPin} label="Local" value={activity.location || "-"} />
          <Field
            icon={IconHourglass}
            label="Carga horária"
            value={`${activity.workloadHours ?? "-"}h`}
          />
          <Field
            icon={IconUsers}
            label="Inscritos"
            value={`${participantsCount} / ${activity.maxParticipants ?? "-"}`}
          />
        </SimpleGrid>

        <Divider my="lg" />
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Descrição
          </Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{activity.description || "—"}</Text>
        </Stack>

        <Divider my="lg" />
        <Group>
          <Button
            leftSection={<IconUsers size={18} />}
            onClick={() => navigate(`/org/activity/${id}/participants`)}
          >
            Participantes ({participantsCount})
          </Button>

          {isActive && (
            <>
              <Button
                variant="light"
                leftSection={<IconEdit size={18} />}
                onClick={() => navigate(`/org/activity/${id}/edit`)}
              >
                Editar
              </Button>
              <Button
                variant="light"
                color="navy"
                leftSection={<IconCheck size={18} />}
                onClick={finishHandlers.open}
              >
                Finalizar
              </Button>
            </>
          )}

          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={18} />}
            onClick={deleteHandlers.open}
          >
            Excluir
          </Button>
        </Group>
      </Paper>

      <Modal opened={finishModal} onClose={finishHandlers.close} title="Finalizar atividade" centered>
        <Text size="sm" mb="lg">
          Ao finalizar, certificados serão gerados para todos os participantes com presença
          confirmada. Confirme que todas as presenças foram validadas. Esta ação não pode ser
          desfeita.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={finishHandlers.close}>
            Cancelar
          </Button>
          <Button color="navy" loading={busy} onClick={handleFinish}>
            Finalizar e gerar certificados
          </Button>
        </Group>
      </Modal>

      <Modal opened={deleteModal} onClose={deleteHandlers.close} title="Excluir atividade" centered>
        <Text size="sm" mb="lg">
          Tem certeza que deseja excluir esta atividade? Todas as inscrições relacionadas também
          serão removidas. Esta ação não pode ser desfeita.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={deleteHandlers.close}>
            Cancelar
          </Button>
          <Button color="red" loading={busy} onClick={handleDelete}>
            Excluir
          </Button>
        </Group>
      </Modal>
    </>
  );
}
