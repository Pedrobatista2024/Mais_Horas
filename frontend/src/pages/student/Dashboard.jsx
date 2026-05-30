import { useNavigate } from "react-router-dom";
import { SimpleGrid, Card, Button, Group, Text, Stack, Title } from "@mantine/core";
import {
  IconHourglassHigh,
  IconCertificate,
  IconCalendarEvent,
  IconSearch,
  IconArrowRight,
} from "@tabler/icons-react";

import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/format";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading } = useFetch("/dashboard/student");

  if (loading) return <Loading />;

  const participations = data?.participations || [];
  const certificates = data?.certificates || [];
  const totalHours = data?.totalHours || 0;

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name?.split(" ")[0] || "estudante"} 👋`}
        subtitle="Acompanhe suas horas complementares e encontre novas atividades."
        action={
          <Button leftSection={<IconSearch size={18} />} onClick={() => navigate("/activities")}>
            Buscar atividades
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <StatCard icon={IconHourglassHigh} label="Horas validadas" value={`${totalHours}h`} />
        <StatCard
          icon={IconCertificate}
          label="Certificados"
          value={certificates.length}
          color="navy"
        />
        <StatCard
          icon={IconCalendarEvent}
          label="Inscrições"
          value={participations.length}
          color="brand"
        />
      </SimpleGrid>

      <Title order={4} mb="sm">
        Minhas inscrições recentes
      </Title>

      {participations.length === 0 ? (
        <EmptyState
          icon={IconCalendarEvent}
          title="Você ainda não se inscreveu em nenhuma atividade"
          description="Explore as vagas oferecidas pelas ONGs e comece a somar horas."
          action={{
            label: "Ver atividades",
            icon: <IconSearch size={16} />,
            onClick: () => navigate("/activities"),
          }}
        />
      ) : (
        <Stack gap="sm">
          {participations.slice(0, 5).map((p) => (
            <Card
              key={p._id}
              withBorder
              radius="md"
              padding="md"
              style={{ cursor: "pointer" }}
              onClick={() => p.activity?._id && navigate(`/student/activity/${p.activity._id}`)}
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} truncate>
                    {p.activity?.title || "Atividade"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(p.activity?.date)} · {p.activity?.location || "-"}
                  </Text>
                </div>
                <Group gap="sm" wrap="nowrap">
                  <StatusBadge status={p.status} />
                  <IconArrowRight size={18} opacity={0.5} />
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
