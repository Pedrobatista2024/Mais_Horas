import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SimpleGrid, Button, Card, Group, Text, Stack, Title } from "@mantine/core";
import {
  IconPlus,
  IconCalendarEvent,
  IconActivity,
  IconCircleCheck,
  IconArrowRight,
  IconUserCircle,
} from "@tabler/icons-react";

import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/format";

export default function OrgDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading } = useFetch("/activities/my");

  const stats = useMemo(() => {
    const all = data || [];
    return {
      total: all.length,
      active: all.filter((a) => a.status === "active").length,
      finished: all.filter((a) => a.status === "finished").length,
    };
  }, [data]);

  if (loading) return <Loading />;

  const recent = (data || []).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name || "organização"} 👋`}
        subtitle="Gerencie suas atividades e valide a presença dos estudantes."
        action={
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate("/org/create-activity")}>
            Nova atividade
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <StatCard icon={IconCalendarEvent} label="Total de atividades" value={stats.total} color="navy" />
        <StatCard icon={IconActivity} label="Ativas" value={stats.active} color="brand" />
        <StatCard icon={IconCircleCheck} label="Finalizadas" value={stats.finished} color="navy" />
      </SimpleGrid>

      <Group justify="space-between" mb="sm">
        <Title order={4}>Atividades recentes</Title>
        <Button variant="subtle" size="compact-sm" onClick={() => navigate("/org/my-activities")}>
          Ver todas
        </Button>
      </Group>

      {recent.length === 0 ? (
        <EmptyState
          icon={IconCalendarEvent}
          title="Você ainda não criou atividades"
          description="Publique sua primeira vaga de voluntariado e comece a receber estudantes."
          action={{
            label: "Criar atividade",
            icon: <IconPlus size={16} />,
            onClick: () => navigate("/org/create-activity"),
          }}
        />
      ) : (
        <Stack gap="sm">
          {recent.map((a) => (
            <Card
              key={a._id}
              withBorder
              radius="md"
              padding="md"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/org/activity/${a._id}`)}
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} truncate>
                    {a.title}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(a.date)} · {a.location || "-"}
                  </Text>
                </div>
                <Group gap="sm" wrap="nowrap">
                  <StatusBadge status={a.status} />
                  <IconArrowRight size={18} opacity={0.5} />
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Card withBorder radius="md" padding="lg" mt="xl">
        <Group justify="space-between">
          <Group>
            <IconUserCircle size={28} />
            <div>
              <Text fw={700}>Perfil da organização</Text>
              <Text size="sm" c="dimmed">
                Um perfil completo passa mais confiança para os estudantes.
              </Text>
            </div>
          </Group>
          <Button variant="light" onClick={() => navigate("/org/profile")}>
            Ver perfil
          </Button>
        </Group>
      </Card>
    </>
  );
}
