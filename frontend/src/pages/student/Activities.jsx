import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SimpleGrid, TextInput, Button, Anchor, Text } from "@mantine/core";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";

import PageHeader from "../../components/ui/PageHeader";
import ActivityCard from "../../components/ui/ActivityCard";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { api } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

export default function Activities() {
  const navigate = useNavigate();
  const { data, loading } = useFetch("/activities");
  const [search, setSearch] = useState("");
  const [joining, setJoining] = useState(null);

  const visible = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const term = search.trim().toLowerCase();

    return (data || [])
      .filter((a) => {
        if (a?.status !== "active" || !a?.date) return false;
        const d = new Date(a.date);
        if (Number.isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        if (d < today) return false;
        if (!term) return true;
        return (
          a.title?.toLowerCase().includes(term) ||
          a.location?.toLowerCase().includes(term) ||
          a.createdBy?.name?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data, search]);

  async function handleJoin(id) {
    setJoining(id);
    try {
      await api.post(`/activities/${id}/join`);
      notifySuccess("Inscrição realizada! Acompanhe em 'Minhas inscrições'.");
    } catch (err) {
      notifyError(err, "Erro ao se inscrever");
    } finally {
      setJoining(null);
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Buscar atividades"
        subtitle="Vagas de voluntariado oferecidas pelas ONGs. Inscreva-se e some horas."
      />

      <TextInput
        placeholder="Buscar por título, local ou ONG..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="lg"
        maw={420}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={IconSearch}
          title="Nenhuma atividade encontrada"
          description="Não há vagas abertas no momento (ou nada bate com a sua busca)."
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {visible.map((activity) => {
            const orgId = activity?.createdBy?._id || activity?.createdBy;
            return (
              <ActivityCard
                key={activity._id}
                activity={activity}
                orgSlot={
                  <Text size="sm" c="dimmed">
                    por{" "}
                    <Anchor
                      size="sm"
                      fw={600}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (orgId) navigate(`/org/${orgId}/public`);
                      }}
                    >
                      {activity?.createdBy?.name || "ONG"}
                    </Anchor>
                  </Text>
                }
                footer={
                  <Button
                    fullWidth
                    mt="xs"
                    leftSection={<IconUserPlus size={18} />}
                    loading={joining === activity._id}
                    onClick={() => handleJoin(activity._id)}
                  >
                    Participar
                  </Button>
                }
              />
            );
          })}
        </SimpleGrid>
      )}
    </>
  );
}
