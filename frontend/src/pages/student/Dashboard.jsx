import { useNavigate } from "react-router-dom";
import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCertificate,
  IconHourglassHigh,
  IconSearch,
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

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading } = useFetch("/dashboard/student");

  if (loading) return <Loading />;

  const participations = data?.participations || [];
  const certificates = data?.certificates || [];
  const totalHours = data?.totalHours || 0;
  const pendingCount = participations.filter((p) => p.status === "pending").length;
  const validatedCount = participations.filter((p) => p.status === "present").length;
  const validatedLabel =
    validatedCount === 1 ? "1 presença confirmada" : `${validatedCount} presenças confirmadas`;
  const pendingLabel =
    pendingCount === 1 ? "1 inscrição aguardando validação" : "Inscrições aguardando validação";

  return (
    <>
      <PageHeader
        eyebrow="Painel do estudante"
        title={`Olá, ${user?.name?.split(" ")[0] || "estudante"}`}
        subtitle="Acompanhe suas horas complementares, inscrições e certificados emitidos pelas ONGs."
        action={
          <Button leftSection={<IconSearch size={18} />} onClick={() => navigate("/activities")}>
            Buscar atividades
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <StatCard
          icon={IconHourglassHigh}
          label="Horas validadas"
          value={`${totalHours}h`}
          helper={validatedLabel}
        />
        <StatCard
          icon={IconCertificate}
          label="Certificados"
          value={certificates.length}
          color="navy"
          helper="Disponíveis para verificação por QR Code"
        />
        <StatCard
          icon={IconCalendarEvent}
          label="Pendências"
          value={pendingCount}
          color="clay"
          helper={pendingLabel}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="xl">
        <ActionCard
          icon={IconSearch}
          title="Encontrar uma vaga"
          description="Veja oportunidades abertas por data, local ou organização."
          actionLabel="Buscar agora"
          onClick={() => navigate("/activities")}
        />
        <ActionCard
          icon={IconCalendarEvent}
          title="Acompanhar presença"
          description="Confira o status das atividades em que você já se inscreveu."
          actionLabel="Minhas inscrições"
          color="navy"
          onClick={() => navigate("/my-activities")}
        />
        <ActionCard
          icon={IconCertificate}
          title="Comprovar horas"
          description="Acesse seus certificados e compartilhe o código de verificação."
          actionLabel="Ver certificados"
          color="clay"
          onClick={() => navigate("/my-certificates")}
        />
      </SimpleGrid>

      <Group justify="space-between" mb="sm">
        <Title order={4}>Inscrições recentes</Title>
        {participations.length > 0 && (
          <Button variant="subtle" size="compact-sm" onClick={() => navigate("/my-activities")}>
            Ver todas
          </Button>
        )}
      </Group>

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
              className="mh-card-hover"
              style={{ cursor: "pointer" }}
              onClick={() => p.activity?._id && navigate(`/student/activity/${p.activity._id}`)}
            >
              <Group justify="space-between" wrap="wrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} truncate>
                    {p.activity?.title || "Atividade"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(p.activity?.date)} - {p.activity?.location || "-"}
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
