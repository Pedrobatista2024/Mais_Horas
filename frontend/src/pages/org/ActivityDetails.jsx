import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Divider, Group, Modal, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconEdit,
  IconHourglass,
  IconMapPin,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";

import BackButton from "../../components/ui/BackButton";
import InfoItem from "../../components/ui/InfoItem";
import Loading from "../../components/ui/Loading";
import StatusBadge from "../../components/ui/StatusBadge";
import { useFetch } from "../../hooks/useFetch";
import { api } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";
import { formatDate } from "../../utils/format";

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
      notifySuccess(`Atividade finalizada. ${data.certificadosGerados} certificado(s) gerado(s).`);
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
      <BackButton onClick={() => navigate(-1)} />

      <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} className="mh-page-band">
        <Group justify="space-between" align="flex-start" wrap="wrap" mb="lg">
          <Title order={2}>{activity.title}</Title>
          <StatusBadge status={activity.status} />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <InfoItem icon={IconCalendar} label="Data" value={formatDate(activity.date)} />
          <InfoItem
            icon={IconClock}
            label="Horário"
            value={`${activity.startTime || "-"} - ${activity.endTime || "-"}`}
          />
          <InfoItem icon={IconMapPin} label="Local" value={activity.location || "-"} />
          <InfoItem
            icon={IconHourglass}
            label="Carga horária"
            value={`${activity.workloadHours ?? "-"}h`}
          />
          <InfoItem
            icon={IconUsers}
            label="Inscritos"
            value={`${participantsCount} / ${activity.maxParticipants ?? "-"}`}
          />
        </SimpleGrid>

        <Divider my="lg" />

        <Stack gap={4}>
          <Text size="sm" c="dimmed" fw={700} tt="uppercase">
            Descrição
          </Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{activity.description || "-"}</Text>
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
