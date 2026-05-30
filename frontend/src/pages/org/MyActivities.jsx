import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SimpleGrid, Button, SegmentedControl, Group } from "@mantine/core";
import { IconPlus, IconCalendarEvent } from "@tabler/icons-react";

import PageHeader from "../../components/ui/PageHeader";
import ActivityCard from "../../components/ui/ActivityCard";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";

export default function OrgMyActivities() {
  const navigate = useNavigate();
  const { data, loading } = useFetch("/activities/my");
  const [filter, setFilter] = useState("all");

  const list = useMemo(() => {
    const all = data || [];
    if (filter === "all") return all;
    return all.filter((a) => a.status === filter);
  }, [data, filter]);

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        eyebrow="Gestão de vagas"
        title="Minhas atividades"
        subtitle="Gerencie as vagas que sua organização publicou."
        action={
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate("/org/create-activity")}>
            Nova atividade
          </Button>
        }
      />

      <Group mb="lg">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { label: "Todas", value: "all" },
            { label: "Ativas", value: "active" },
            { label: "Finalizadas", value: "finished" },
          ]}
        />
      </Group>

      {list.length === 0 ? (
        <EmptyState
          icon={IconCalendarEvent}
          title="Nenhuma atividade aqui"
          description="Crie sua primeira atividade para começar a receber inscrições de estudantes."
          action={{
            label: "Criar atividade",
            icon: <IconPlus size={16} />,
            onClick: () => navigate("/org/create-activity"),
          }}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {list.map((activity) => (
            <ActivityCard
              key={activity._id}
              activity={activity}
              onClick={() => navigate(`/org/activity/${activity._id}`)}
            />
          ))}
        </SimpleGrid>
      )}
    </>
  );
}
