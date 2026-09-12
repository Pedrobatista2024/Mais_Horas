import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Badge, Button, Card, Divider, Group, Stack, Text, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconCheck, IconUsers, IconX,
} from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

function Pessoa({ inscricao, acoes }) {
  const { aluno } = inscricao;
  return (
    <Group justify="space-between" wrap="wrap" gap="sm" py="xs">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Avatar src={resolveImage(aluno?.foto)} color="brand" radius="xl" size={40}>
          {initials(aluno?.nome)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Text fw={650} truncate>
            {aluno?.nome}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {[aluno?.curso, aluno?.instituicao].filter(Boolean).join(" · ") ||
              aluno?.email}
          </Text>
        </div>
      </Group>
      {acoes}
    </Group>
  );
}

/**
 * O5 — Inscrições da atividade.
 *
 * É a única tela onde os nomes aparecem, e só para a ONG dona (RN-47). A recusa
 * não pede motivo (D8), então o botão age direto, sem campo de texto.
 */
export default function InscricoesDaAtividade() {
  const { id } = useParams();
  const navegar = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [atividade, setAtividade] = useState(null);
  const [pendentes, setPendentes] = useState([]);
  const [confirmadas, setConfirmadas] = useState([]);
  const [agindo, setAgindo] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const buscar = useCallback(async () => {
    try {
      const [dadosAtividade, fila, lista] = await Promise.all([
        api.get(`/atividades/${id}`),
        api.get(`/atividades/${id}/inscricoes`, { params: { situacao: "pendente" } }),
        api.get(`/atividades/${id}/inscricoes`, { params: { situacao: "confirmada" } }),
      ]);
      setAtividade(dadosAtividade.data);
      setPendentes(fila.data.itens);
      setConfirmadas(lista.data.itens);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar as inscrições"));
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  async function responder(inscricao, aprovar) {
    setAgindo(inscricao.id);
    try {
      await api.post(`/inscricoes/${inscricao.id}/${aprovar ? "aprovar" : "recusar"}`);
      notifySuccess(aprovar
        ? `${inscricao.aluno?.nome} está confirmado.`
        : "Inscrição recusada. A vaga voltou para a lista.");
      await buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível responder"));
      await buscar();
    } finally {
      setAgindo(null);
    }
  }

  async function aprovarTodas() {
    try {
      const { data } = await api.post("/inscricoes/aprovar-lote", {
        ids: pendentes.map((i) => i.id),
      });
      // O lote pode aprovar umas e pular outras — dizer só "pronto" esconderia
      // quem ficou de fora.
      if (data.ignoradas.length === 0) {
        notifySuccess(`${data.aprovadas} inscrição(ões) aprovada(s).`);
      } else {
        notifySuccess(
          `${data.aprovadas} aprovada(s). ${data.ignoradas.length} não pôde(ram) ser ` +
          "aprovada(s) — provavelmente foram canceladas nesse meio-tempo.",
        );
      }
      await buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível aprovar em bloco"));
    }
  }

  if (carregando) return <Loading label="Carregando inscrições..." />;

  if (!atividade) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title="Atividade não encontrada"
        description="Ela pode ter sido excluída, ou o endereço está errado."
        action={{ label: "Minhas atividades",
                  onClick: () => navegar("/ong/atividades") }}
      />
    );
  }

  const encerrada = ["cancelada", "finalizada"].includes(atividade.situacao);

  return (
    <Stack gap="lg" maw={880}>
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar(`/ong/atividades/${id}`)}>
        Voltar a gerenciar a atividade
      </Button>

      <Stack gap={4}>
        <Text tt="uppercase" c="brand.7" fw={700} size="xs">
          Inscrições
        </Text>
        <Title order={1} fz={{ base: 24, sm: 30 }} lh={1.15}>
          {atividade.titulo}
        </Title>
        <Text c="dimmed" size="sm">
          {atividade.vagasOcupadas} de {atividade.vagasMax} vagas preenchidas
        </Text>
      </Stack>

      {encerrada && (
        <Alert color="gray" variant="light">
          Atividade {atividade.situacao} — as inscrições não mudam mais.
        </Alert>
      )}

      {atividade.exigeAprovacao && (
        <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
          <Group justify="space-between" wrap="wrap" gap="sm" mb="sm">
            <Group gap="xs">
              <Text fw={700}>Aguardando aprovação</Text>
              <Badge color="yellow" variant="light" radius="sm">
                {pendentes.length}
              </Badge>
            </Group>
            {pendentes.length > 1 && !encerrada && (
              <Button size="compact-sm" variant="light" onClick={aprovarTodas}>
                Aprovar todas
              </Button>
            )}
          </Group>

          {pendentes.length === 0 ? (
            <Text size="sm" c="dimmed">
              Ninguém na fila.
            </Text>
          ) : (
            <Stack gap={0}>
              {pendentes.map((inscricao, indice) => (
                <div key={inscricao.id}>
                  {indice > 0 && <Divider />}
                  <Pessoa
                    inscricao={inscricao}
                    acoes={
                      !encerrada && (
                        <Group gap={6} wrap="nowrap">
                          <Button size="compact-sm" leftSection={<IconCheck size={14} />}
                                  loading={agindo === inscricao.id}
                                  onClick={() => responder(inscricao, true)}>
                            Aprovar
                          </Button>
                          <Button size="compact-sm" variant="subtle" color="red"
                                  leftSection={<IconX size={14} />}
                                  onClick={() => setConfirmando(inscricao)}>
                            Recusar
                          </Button>
                        </Group>
                      )
                    }
                  />
                </div>
              ))}
            </Stack>
          )}
        </Card>
      )}

      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <Group gap="xs" mb="sm">
          <Text fw={700}>Confirmadas</Text>
          <Badge color="brand" variant="light" radius="sm">
            {confirmadas.length}
          </Badge>
        </Group>

        {confirmadas.length === 0 ? (
          <Stack align="center" gap={6} py="md">
            <IconUsers size={28} opacity={0.4} />
            <Text size="sm" c="dimmed" ta="center">
              {atividade.exigeAprovacao
                ? "Ninguém confirmado ainda. Aprove alguém da fila acima."
                : "Ninguém se inscreveu ainda."}
            </Text>
          </Stack>
        ) : (
          <Stack gap={0}>
            {confirmadas.map((inscricao, indice) => (
              <div key={inscricao.id}>
                {indice > 0 && <Divider />}
                <Pessoa inscricao={inscricao} />
              </div>
            ))}
          </Stack>
        )}
      </Card>

      <ConfirmarAcao
        aberto={Boolean(confirmando)}
        aoFechar={() => setConfirmando(null)}
        titulo="Recusar inscrição"
        mensagem={`${confirmando?.aluno?.nome} não participará desta atividade e a vaga voltará para a lista. A pessoa vê apenas "não aprovada", sem motivo.`}
        rotuloConfirmar="Recusar"
        aoConfirmar={() => responder(confirmando, false)}
      />
    </Stack>
  );
}
