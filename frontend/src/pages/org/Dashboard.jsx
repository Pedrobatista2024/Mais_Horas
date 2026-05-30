import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconActivity,
  IconArrowRight,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCircleCheck,
  IconPlus,
  IconUsers,
} from "@tabler/icons-react";

import ActionCard from "../../components/ui/ActionCard";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
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
        eyebrow="Painel da organização"
        title={`Olá, ${user?.name || "organização"}`}
        subtitle="Publique atividades, acompanhe inscrições e valide a presença dos estudantes."
        action={
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate("/org/create-activity")}>
            Nova atividade
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <StatCard
          icon={IconCalendarEvent}
          label="Total de atividades"
          value={stats.total}
          color="navy"
          helper="Vagas publicadas pela organização"
        />
        <StatCard
          icon={IconActivity}
          label="Ativas"
          value={stats.active}
          color="brand"
          helper="Recebendo inscrições ou validações"
        />
        <StatCard
          icon={IconCircleCheck}
          label="Finalizadas"
          value={stats.finished}
          color="navy"
          helper="Prontas para certificados"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="xl">
        <ActionCard
          icon={IconPlus}
          title="Publicar oportunidade"
          description="Crie uma vaga com data, local, carga horária e limite de participantes."
          actionLabel="Criar atividade"
          onClick={() => navigate("/org/create-activity")}
        />
        <ActionCard
          icon={IconUsers}
          title="Validar estudantes"
          description="Abra suas atividades para confirmar presença e emitir certificados."
          actionLabel="Gerenciar atividades"
          color="navy"
          onClick={() => navigate("/org/my-activities")}
        />
        <ActionCard
          icon={IconBuildingCommunity}
          title="Fortalecer perfil"
          description="Um perfil completo passa mais confiança para quem busca horas."
          actionLabel="Ver perfil"
          color="clay"
          onClick={() => navigate("/org/profile")}
        />
      </SimpleGrid>

      <Group justify="space-between" mb="sm">
        <Title order={4}>Atividades recentes</Title>
        {recent.length > 0 && (
          <Button variant="subtle" size="compact-sm" onClick={() => navigate("/org/my-activities")}>
            Ver todas
          </Button>
        )}
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
              className="mh-card-hover"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/org/activity/${a._id}`)}
            >
              <Group justify="space-between" wrap="wrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} truncate>
                    {a.title}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(a.date)} - {a.location || "-"}
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
    </>
  );
}
