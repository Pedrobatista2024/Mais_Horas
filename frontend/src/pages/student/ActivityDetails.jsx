import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Anchor, Button, Divider, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconCalendar,
  IconClock,
  IconHourglass,
  IconMapPin,
  IconUserPlus,
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
      <BackButton onClick={() => navigate(-1)} />

      <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} className="mh-page-band">
        <Group justify="space-between" align="flex-start" wrap="wrap" mb="xs">
          <Title order={2}>{activity.title}</Title>
          <StatusBadge status={activity.status} />
        </Group>

        <Text c="dimmed" mb="lg">
          Oferecida por{" "}
          <Anchor fw={700} onClick={() => orgId && navigate(`/org/${orgId}/public`)}>
            {activity?.createdBy?.name || "ONG"}
          </Anchor>
        </Text>

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
            label="Vagas"
            value={`mín ${activity.minParticipants ?? "-"} / máx ${activity.maxParticipants ?? "-"}`}
          />
        </SimpleGrid>

        <Divider my="lg" />

        <Stack gap={4}>
          <Text size="sm" c="dimmed" fw={700} tt="uppercase">
            Descrição
          </Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{activity.description || "-"}</Text>
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
