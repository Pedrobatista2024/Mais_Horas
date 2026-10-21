import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Group, Stack, Text, Title,
} from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconUsers } from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

function Pessoa({ inscricao, acoes }) {
  const { aluno } = inscricao;
  const curso = [aluno?.curso, aluno?.instituicao].filter(Boolean).join(", ");
  return (
    <Group className="mh-linha" justify="space-between" wrap="wrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: "1 1 260px" }}>
        <Avatar src={resolveImage(aluno?.foto)} color="brand" radius="xl" size={36}
                alt={aluno?.nome}>
          {initials(aluno?.nome)}
        </Avatar>
        <Box style={{ minWidth: 0 }}>
          <Text fw={600} truncate>{aluno?.nome}</Text>
          <Text size="sm" c="dimmed" truncate>{curso || aluno?.email}</Text>
        </Box>
      </Group>
      {acoes}
    </Group>
  );
}

function Secao({ titulo, quantidade, acao, children }) {
  return (
    <Box component="section">
      <Group justify="space-between" align="center" mb="sm" gap="sm">
        <Title order={2} fz="lg">
          {titulo} <Text span c="dimmed" fw={400} className="mh-num">({quantidade})</Text>
        </Title>
        {acao}
      </Group>
      {children}
    </Box>
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
      const aprovadas = `${data.aprovadas} ${data.aprovadas === 1 ? "inscrição aprovada" : "inscrições aprovadas"}`;
      if (data.ignoradas.length === 0) {
        notifySuccess(`${aprovadas}.`);
      } else {
        notifySuccess(`${aprovadas}. ${data.ignoradas.length} ficaram de fora: a pessoa ` +
                      "cancelou enquanto você aprovava.");
      }
      await buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível aprovar em bloco"));
    }
  }

  if (carregando) return <Loading label="Carregando inscrições…" />;

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
    <>
      <PageHeader
        voltar={{ para: `/ong/atividades/${id}`, rotulo: atividade.titulo }}
        title="Inscrições"
        subtitle={`${atividade.vagasOcupadas} de ${atividade.vagasMax} vagas preenchidas.`}
      />

      <Stack gap={36}>
        {encerrada && (
          <Alert color="gray">
            A atividade está {atividade.situacao}. As inscrições não mudam mais.
          </Alert>
        )}

        {atividade.exigeAprovacao && (
          <Secao titulo="Esperando sua aprovação" quantidade={pendentes.length}
                 acao={pendentes.length > 1 && !encerrada && (
                   <Button size="xs" variant="default" onClick={aprovarTodas}>
                     Aprovar todas
                   </Button>
                 )}>
            {pendentes.length === 0 ? (
              <Text size="sm" c="dimmed">Ninguém esperando resposta.</Text>
            ) : (
              <Box className="mh-lista">
                {pendentes.map((inscricao) => (
                  <Pessoa
                    key={inscricao.id}
                    inscricao={inscricao}
                    acoes={!encerrada && (
                      <Group gap={6} wrap="nowrap">
                        <Button size="xs" leftSection={<IconCheck size={14} />}
                                loading={agindo === inscricao.id}
                                onClick={() => responder(inscricao, true)}>
                          Aprovar
                        </Button>
                        <Button size="xs" variant="default"
                                onClick={() => setConfirmando(inscricao)}>
                          Recusar
                        </Button>
                      </Group>
                    )}
                  />
                ))}
              </Box>
            )}
          </Secao>
        )}

        <Secao titulo="Confirmadas" quantidade={confirmadas.length}>
          {confirmadas.length === 0 ? (
            <EmptyState compacto icon={IconUsers}
                        title={atividade.exigeAprovacao ? "Ninguém confirmado ainda"
                                                        : "Ninguém se inscreveu ainda"}
                        description={atividade.exigeAprovacao
                          ? "Aprove alguém da lista acima."
                          : "As inscrições aparecem aqui assim que chegam."} />
          ) : (
            <Box className="mh-lista">
              {confirmadas.map((inscricao) => (
                <Pessoa key={inscricao.id} inscricao={inscricao} />
              ))}
            </Box>
          )}
        </Secao>
      </Stack>

      <ConfirmarAcao
        aberto={Boolean(confirmando)}
        aoFechar={() => setConfirmando(null)}
        titulo="Recusar inscrição"
        mensagem={`${confirmando?.aluno?.nome} não vai participar desta atividade e a vaga volta para a lista. A pessoa vê só "não aprovada", sem motivo.`}
        rotuloConfirmar="Recusar inscrição"
        aoConfirmar={() => responder(confirmando, false)}
      />
    </>
  );
}
