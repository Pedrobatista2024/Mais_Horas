import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Paper,
  Title,
  Text,
  Group,
  Button,
  SimpleGrid,
  Stack,
  Anchor,
  Divider,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconUserPlus,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconHourglass,
  IconUsers,
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

export default function StudentActivityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: activity, loading } = useFetch(`/activities/${id}`);
  const [joining, setJoining] = useState(false);

  if (loading) return <Loading />;
  if (!activity) return <Text>Atividade não encontrada.</Text>;

  const orgId = activity?.createdBy?._id || activity?.createdBy;

  async function handleJoin() {
    setJoining(true);
    try {
      await api.post(`/activities/${id}/join`);
      notifySuccess("Inscrição realizada com sucesso!");
      navigate("/my-activities");
    } catch (err) {
      notifyError(err, "Erro ao se inscrever");
    } finally {
      setJoining(false);
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
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xs">
          <Title order={2}>{activity.title}</Title>
          <StatusBadge status={activity.status} />
        </Group>

        <Text c="dimmed" mb="lg">
          Oferecida por{" "}
          <Anchor fw={600} onClick={() => orgId && navigate(`/org/${orgId}/public`)}>
            {activity?.createdBy?.name || "ONG"}
          </Anchor>
        </Text>

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
            label="Vagas"
            value={`mín ${activity.minParticipants ?? "-"} / máx ${activity.maxParticipants ?? "-"}`}
          />
        </SimpleGrid>

        <Divider my="lg" />

        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Descrição
          </Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{activity.description || "—"}</Text>
        </Stack>

        {activity.status === "active" && (
          <Button
            mt="xl"
            size="md"
            leftSection={<IconUserPlus size={18} />}
            loading={joining}
            onClick={handleJoin}
          >
            Participar desta atividade
          </Button>
        )}
      </Paper>
    </>
  );
}
