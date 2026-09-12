import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Divider, Grid, Group, Stack, Text, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconCalendar, IconClock, IconEdit,
  IconEye, IconMapPin, IconTrash, IconUsers, IconUsersGroup, IconX,
} from "@tabler/icons-react";

import SituacaoBadge from "../../components/atividade/SituacaoBadge";
import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { formatDateLong } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

function Dado({ icon: Icon, rotulo, children }) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Icon size={19} style={{ marginTop: 2, opacity: 0.55, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {rotulo}
        </Text>
        <Text fw={650}>{children}</Text>
      </div>
    </Group>
  );
}

/**
 * O4 — Gerenciar atividade.
 *
 * Concentra o ciclo de vida. Cada botão só aparece na situação em que faz
 * sentido: a exclusão some assim que a atividade deixa de ser rascunho, porque
 * apagar uma finalizada destruiria certificados já entregues (RN-20).
 */
export default function GerenciarAtividade() {
  const { id } = useParams();
  const navegar = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [agindo, setAgindo] = useState(false);
  const [atividade, setAtividade] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const buscar = useCallback(async () => {
    try {
      const { data } = await api.get(`/atividades/${id}`);
      setAtividade(data);
    } catch (erro) {
      setAtividade(null);
      if (erro?.response?.status !== 404) {
        notifyError(mensagemDoErro(erro, "Não foi possível carregar a atividade"));
      }
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  async function publicar() {
    setAgindo(true);
    try {
      const { data } = await api.post(`/atividades/${id}/publicar`);
      setAtividade(data);
      notifySuccess("Atividade publicada. Ela já aparece na vitrine.");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível publicar"));
    } finally {
      setAgindo(false);
    }
  }

  async function cancelar(motivo) {
    try {
      const { data } = await api.post(`/atividades/${id}/cancelar`, { motivo });
      setAtividade(data);
      notifySuccess("Atividade cancelada e inscrições encerradas.");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
    }
  }

  async function excluir() {
    try {
      await api.delete(`/atividades/${id}`);
      notifySuccess("Rascunho excluído.");
      navegar("/ong/atividades");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível excluir"));
    }
  }

  if (carregando) return <Loading label="Carregando atividade..." />;

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

  const { situacao } = atividade;
  const eRascunho = situacao === "rascunho";
  const podeEditar = ["rascunho", "publicada"].includes(situacao);
  const podeCancelar = ["publicada", "em_andamento", "aguardando_validacao"]
    .includes(situacao);
  const eExcluir = confirmando === "excluir";

  return (
    <Stack gap="lg" maw={900}>
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar("/ong/atividades")}>
        Voltar às minhas atividades
      </Button>

      <Stack gap="xs">
        <Group gap="xs" wrap="wrap">
          <SituacaoBadge situacao={situacao} size="md" />
          <Badge color="clay" variant="light" radius="sm" size="md">
            {atividade.cargaHoraria}h
          </Badge>
          {atividade.exigeAprovacao && (
            <Badge color="yellow" variant="light" radius="sm" size="md">
              Aprovação necessária
            </Badge>
          )}
        </Group>
        <Title order={1} fz={{ base: 26, sm: 34 }} lh={1.1}>
          {atividade.titulo}
        </Title>
      </Stack>

      {eRascunho && (
        <Alert color="gray" variant="light">
          Este rascunho é só seu — ninguém o vê na vitrine até você publicar.
        </Alert>
      )}
      {situacao === "cancelada" && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
          Atividade cancelada. As inscrições foram encerradas.
        </Alert>
      )}
      {atividade.editadaPorAdminEm && (
        <Alert color="navy" variant="light" icon={<IconAlertTriangle size={18} />}>
          Esta atividade foi editada pela administração da plataforma.
        </Alert>
      )}

      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Dado icon={IconCalendar} rotulo="Data">
              {formatDateLong(atividade.data)}
            </Dado>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Dado icon={IconClock} rotulo="Horário">
              {atividade.horaInicio} às {atividade.horaFim}
            </Dado>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Dado icon={IconMapPin} rotulo="Local">
              {[atividade.local, atividade.cidade, atividade.estado]
                .filter(Boolean).join(", ")}
            </Dado>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Dado icon={IconUsers} rotulo="Vagas">
              {atividade.vagasOcupadas} de {atividade.vagasMax} preenchidas
              {" · mínimo "}{atividade.vagasMin}
            </Dado>
          </Grid.Col>
        </Grid>

        <Divider my="lg" />

        <Stack gap="xs">
          <Text fw={700}>Descrição</Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{atividade.descricao}</Text>
        </Stack>
      </Card>

      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <Stack gap="md">
          <Text fw={700}>Ações</Text>
          <Group gap="sm" wrap="wrap">
            {eRascunho && (
              <Button onClick={publicar} loading={agindo}>
                Publicar atividade
              </Button>
            )}
            {podeEditar && (
              <Button variant="light" leftSection={<IconEdit size={16} />}
                      onClick={() => navegar(`/ong/atividades/${id}/editar`)}>
                Editar
              </Button>
            )}
            {!eRascunho && (
              <Button variant="light" leftSection={<IconUsersGroup size={16} />}
                      onClick={() => navegar(`/ong/atividades/${id}/inscricoes`)}>
                Ver inscrições
                {atividade.vagasOcupadas > 0 && ` (${atividade.vagasOcupadas})`}
              </Button>
            )}
            {!eRascunho && (
              <Button variant="light" leftSection={<IconEye size={16} />}
                      onClick={() => navegar(`/atividades/${id}`)}>
                Ver como o aluno vê
              </Button>
            )}
            {podeCancelar && (
              <Button variant="subtle" color="red" leftSection={<IconX size={16} />}
                      onClick={() => setConfirmando("cancelar")}>
                Cancelar atividade
              </Button>
            )}
            {eRascunho && (
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />}
                      onClick={() => setConfirmando("excluir")}>
                Excluir rascunho
              </Button>
            )}
          </Group>

          {atividade.vagasOcupadas > 0 && (
            <Text size="xs" c="dimmed">
              Com {atividade.vagasOcupadas} inscrito(s), a edição fica limitada ao
              número de vagas.
            </Text>
          )}
        </Stack>
      </Card>

      <ConfirmarAcao
        aberto={Boolean(confirmando)}
        aoFechar={() => setConfirmando(null)}
        titulo={eExcluir ? "Excluir rascunho" : "Cancelar atividade"}
        mensagem={
          eExcluir
            ? `"${atividade.titulo}" será apagado definitivamente.`
            : `"${atividade.titulo}" sai da vitrine e todas as inscrições são encerradas. Não dá para reabrir.`
        }
        rotuloConfirmar={eExcluir ? "Excluir" : "Cancelar atividade"}
        pedirMotivo={!eExcluir}
        aoConfirmar={(motivo) => (eExcluir ? excluir() : cancelar(motivo))}
      />
    </Stack>
  );
}
