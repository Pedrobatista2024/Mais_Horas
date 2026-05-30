import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Group, Text, Button, SimpleGrid, Anchor, Alert, Avatar } from "@mantine/core";
import { IconArrowLeft, IconCheck, IconX, IconAlertTriangle, IconUsers } from "@tabler/icons-react";

import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { api } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";
import { initials } from "../../utils/format";

export default function ActivityParticipants() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, setData } = useFetch(`/participations/activity/${id}`);
  const [savingId, setSavingId] = useState(null);

  const participants = useMemo(
    () =>
      [...(data || [])].sort((a, b) =>
        (a?.user?.name || "").localeCompare(b?.user?.name || "")
      ),
    [data]
  );

  const stats = useMemo(() => {
    const s = { total: participants.length, pending: 0, present: 0, absent: 0 };
    participants.forEach((p) => {
      s[p.status] = (s[p.status] || 0) + 1;
    });
    return s;
  }, [participants]);

  async function validate(participationId, status) {
    setSavingId(participationId + status);
    try {
      await api.put(`/participations/${participationId}/validate`, { status });
      setData((prev) =>
        (prev || []).map((p) => (p._id === participationId ? { ...p, status } : p))
      );
      notifySuccess(status === "present" ? "Presença confirmada." : "Marcado como ausente.");
    } catch (err) {
      notifyError(err, "Erro ao validar presença");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <Loading />;

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

      <PageHeader
        title="Participantes"
        subtitle="Confirme presença/ausência. A atividade só finaliza sem pendências."
      />

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={IconUsers} label="Total" value={stats.total} color="navy" />
        <StatCard label="Pendentes" value={stats.pending} color="yellow" icon={IconAlertTriangle} />
        <StatCard label="Presentes" value={stats.present} color="brand" icon={IconCheck} />
        <StatCard label="Ausentes" value={stats.absent} color="red" icon={IconX} />
      </SimpleGrid>

      {stats.pending > 0 && (
        <Alert icon={<IconAlertTriangle size={18} />} color="yellow" mb="lg">
          Responda a presença de todos os participantes antes de finalizar a atividade.
        </Alert>
      )}

      {participants.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title="Nenhum participante inscrito ainda"
          description="Quando estudantes se inscreverem, eles aparecem aqui para validação."
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {participants.map((p) => {
            const studentId = p?.user?._id;
            return (
              <Card key={p._id} withBorder radius="md" padding="md">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Group wrap="nowrap" align="flex-start">
                    <Avatar color="brand" radius="xl">
                      {initials(p?.user?.name)}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Anchor
                        fw={700}
                        onClick={() => studentId && navigate(`/student/${studentId}/public`)}
                      >
                        {p?.user?.name || "Aluno"}
                      </Anchor>
                      <Text size="sm" c="dimmed" truncate>
                        {p?.user?.email || "-"}
                      </Text>
                      <StatusBadge status={p.status} mt={6} />
                    </div>
                  </Group>
                </Group>

                <Group mt="md" gap="xs">
                  <Button
                    size="xs"
                    variant={p.status === "present" ? "filled" : "light"}
                    color="brand"
                    leftSection={<IconCheck size={14} />}
                    loading={savingId === p._id + "present"}
                    onClick={() => validate(p._id, "present")}
                  >
                    Presente
                  </Button>
                  <Button
                    size="xs"
                    variant={p.status === "absent" ? "filled" : "light"}
                    color="red"
                    leftSection={<IconX size={14} />}
                    loading={savingId === p._id + "absent"}
                    onClick={() => validate(p._id, "absent")}
                  >
                    Ausente
                  </Button>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </>
  );
}
