import { useNavigate } from "react-router-dom";
import { Card, Group, Text, Stack } from "@mantine/core";
import { IconArrowRight, IconCalendarEvent, IconSearch } from "@tabler/icons-react";

import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { formatDate } from "../../utils/format";

export default function MyActivities() {
  const navigate = useNavigate();
  const { data, loading } = useFetch("/participations/my");

  if (loading) return <Loading />;

  const list = (data || []).filter((p) => p.activity);

  return (
    <>
      <PageHeader
        eyebrow="Minha jornada"
        title="Minhas inscrições"
        subtitle="Atividades em que você se inscreveu e o status da sua presença."
      />

      {list.length === 0 ? (
        <EmptyState
          icon={IconCalendarEvent}
          title="Nenhuma inscrição ainda"
          description="Quando você se inscrever em uma atividade, ela aparece aqui."
          action={{
            label: "Buscar atividades",
            icon: <IconSearch size={16} />,
            onClick: () => navigate("/activities"),
          }}
        />
      ) : (
        <Stack gap="sm">
          {list.map((p) => (
            <Card
              key={p._id}
              withBorder
              radius="md"
              padding="md"
              className="mh-card-hover"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/student/activity/${p.activity._id}`)}
            >
              <Group justify="space-between" wrap="wrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} truncate>
                    {p.activity.title}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {formatDate(p.activity.date)} · {p.activity.location || "-"} ·{" "}
                    {p.activity.workloadHours ?? "-"}h
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
