import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ActionIcon, Alert, Anchor, Badge, Box, Button, Grid, Group, Menu, Stack, Text, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconClipboardCheck, IconDots, IconEdit, IconEye, IconQrcode,
  IconTrash, IconX,
} from "@tabler/icons-react";

import SituacaoBadge from "../../components/atividade/SituacaoBadge";
import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Horas from "../../components/ui/Horas";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { formatDateLong, formatHorario } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

function Dado({ rotulo, children }) {
  return (
    <Box>
      <Text size="sm" c="dimmed">{rotulo}</Text>
      <Text fw={500}>{children}</Text>
    </Box>
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
      notifySuccess("Atividade cancelada. Os inscritos foram avisados.");
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

  if (carregando) return <Loading label="Carregando atividade…" />;

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

  // A ação principal muda com a situação; as outras ficam ao lado ou no menu.
  let principal = null;
  if (eRascunho) {
    principal = <Button onClick={publicar} loading={agindo}>Publicar</Button>;
  } else if (situacao === "em_andamento") {
    principal = (
      <Button component={Link} to={`/ong/atividades/${id}/check-in`}
              leftSection={<IconQrcode size={16} />}>
        Abrir check-in
      </Button>
    );
  } else if (situacao === "aguardando_validacao") {
    principal = (
      <Button component={Link} to={`/ong/atividades/${id}/presencas`}
              leftSection={<IconClipboardCheck size={16} />}>
        Validar presenças
      </Button>
    );
  }

  const menu = [
    !eRascunho && { rotulo: "Ver como o aluno vê", icone: IconEye,
                    aoClicar: () => navegar(`/vagas/${id}`) },
    situacao === "finalizada" && { rotulo: "Ver presenças", icone: IconClipboardCheck,
                                   aoClicar: () => navegar(`/ong/atividades/${id}/presencas`) },
    podeCancelar && { rotulo: "Cancelar atividade", icone: IconX, cor: "red",
                      aoClicar: () => setConfirmando("cancelar") },
    eRascunho && { rotulo: "Excluir rascunho", icone: IconTrash, cor: "red",
                   aoClicar: () => setConfirmando("excluir") },
  ].filter(Boolean);

  const endereco = [atividade.local, atividade.cidade, atividade.estado]
    .filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        voltar={{ para: "/ong/atividades", rotulo: "Minhas atividades" }}
        title={atividade.titulo}
        badge={<SituacaoBadge situacao={situacao} size="lg" />}
        action={
          <>
            {principal}
            {podeEditar && (
              <Button variant="default" leftSection={<IconEdit size={16} />}
                      component={Link} to={`/ong/atividades/${id}/editar`}>
                Editar
              </Button>
            )}
            {menu.length > 0 && (
              <Menu position="bottom-end" shadow="sm" width={230}>
                <Menu.Target>
                  <ActionIcon variant="default" size={36} aria-label="Mais ações">
                    <IconDots size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {menu.map((item) => (
                    <Menu.Item key={item.rotulo} color={item.cor}
                               leftSection={<item.icone size={15} />}
                               onClick={item.aoClicar}>
                      {item.rotulo}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
          </>
        }
      />

      <Stack gap="md" mb="lg">
        {eRascunho && (
          <Alert color="gray">
            Este rascunho só aparece para você. Ninguém o vê na vitrine até você publicar.
          </Alert>
        )}
        {situacao === "cancelada" && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />}>
            Atividade cancelada. As inscrições foram encerradas.
          </Alert>
        )}
        {atividade.editadaPorAdminEm && (
          <Alert color="brand" icon={<IconAlertTriangle size={18} />}>
            A administração da plataforma editou esta atividade.
          </Alert>
        )}
      </Stack>

      <Grid gutter={{ base: "lg", md: 40 }}>
        <Grid.Col span={{ base: 12, md: 4 }} order={{ base: 1, md: 2 }}>
          <Box className="mh-bloco" p="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600}>Carga horária</Text>
                <Horas valor={atividade.cargaHoraria} style={{ fontSize: "0.9375rem" }} />
              </Group>
              <Dado rotulo="Quando">
                {formatDateLong(atividade.data)}
                <br />
                {formatHorario(atividade.horaInicio, atividade.horaFim)}
              </Dado>
              <Dado rotulo="Onde">{endereco}</Dado>
              <Box>
                <Text size="sm" c="dimmed">Inscrições</Text>
                <Text fw={500} className="mh-num">
                  {atividade.vagasOcupadas} de {atividade.vagasMax} vagas
                  {atividade.vagasMin > 1 ? `, mínimo ${atividade.vagasMin}` : ""}
                </Text>
                {atividade.exigeAprovacao && (
                  <Badge color="gray" mt={6}>Você aprova cada inscrição</Badge>
                )}
                {!eRascunho && (
                  <Anchor component={Link} to={`/ong/atividades/${id}/inscricoes`}
                          size="sm" display="block" mt={8}>
                    Ver inscrições
                  </Anchor>
                )}
              </Box>
              {podeEditar && atividade.vagasOcupadas > 0 && (
                <Text size="sm" c="dimmed">
                  Com inscritos, só o número de vagas pode mudar.
                </Text>
              )}
            </Stack>
          </Box>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }} order={{ base: 2, md: 1 }}>
          <Title order={2} fz="lg" mb="xs">Descrição</Title>
          <Text maw={680} style={{ whiteSpace: "pre-wrap" }}>{atividade.descricao}</Text>
        </Grid.Col>
      </Grid>

      <ConfirmarAcao
        aberto={Boolean(confirmando)}
        aoFechar={() => setConfirmando(null)}
        titulo={eExcluir ? "Excluir rascunho" : "Cancelar atividade"}
        mensagem={
          eExcluir
            ? `"${atividade.titulo}" será apagado de vez.`
            : `"${atividade.titulo}" sai da vitrine, as inscrições são encerradas e os inscritos recebem um aviso. Não dá para reabrir.`
        }
        rotuloConfirmar={eExcluir ? "Excluir rascunho" : "Cancelar atividade"}
        rotuloVoltar={eExcluir ? "Manter rascunho" : "Manter atividade"}
        pedirMotivo={!eExcluir}
        aoConfirmar={(motivo) => (eExcluir ? excluir() : cancelar(motivo))}
      />
    </>
  );
}
