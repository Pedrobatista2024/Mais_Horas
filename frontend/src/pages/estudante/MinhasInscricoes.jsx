import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge, Button, Card, Center, Group, Pagination, SimpleGrid, Stack, Tabs, Text,
  Title, Tooltip,
} from "@mantine/core";
import {
  IconCalendar, IconCertificate, IconClock, IconMapPin, IconQrcode, IconSearch,
  IconTicket,
} from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { formatDate } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

const TAMANHO = 12;

const GRUPOS = [
  { valor: "proximas", rotulo: "Próximas" },
  { valor: "aguardando", rotulo: "Aguardando aprovação" },
  { valor: "historico", rotulo: "Histórico" },
];

const VAZIO = {
  proximas: "Nenhuma atividade confirmada pela frente.",
  aguardando: "Nenhum pedido esperando resposta da organização.",
  historico: "Nada no histórico ainda.",
};

/**
 * Selos de `E4`.
 *
 * `recusada` vira "Não aprovada" e **não traz motivo** (D8): a ONG recusa sem
 * justificar, e inventar um texto aqui seria pior que o silêncio.
 */
const SELO = {
  pendente: { rotulo: "Aguardando aprovação", cor: "yellow" },
  confirmada: { rotulo: "Confirmada", cor: "brand" },
  presente: { rotulo: "Presença confirmada", cor: "brand.9" },
  ausente: { rotulo: "Ausente", cor: "gray" },
  recusada: { rotulo: "Não aprovada", cor: "red" },
  cancelada: { rotulo: "Cancelada por você", cor: "gray" },
};

function Linha({ icon: Icon, children }) {
  return (
    <Group gap={7} wrap="nowrap" c="dimmed">
      <Icon size={15} style={{ flexShrink: 0, opacity: 0.75 }} />
      <Text size="sm" truncate>
        {children}
      </Text>
    </Group>
  );
}

/** E4 — Minhas inscrições. */
export default function MinhasInscricoes() {
  const navegar = useNavigate();

  const [grupo, setGrupo] = useState("proximas");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({ itens: [], total: 0, paginas: 1 });
  const [cancelando, setCancelando] = useState(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/inscricoes/minhas", {
        params: { grupo, pagina, tamanho: TAMANHO },
      });
      setResultado(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar suas inscrições"));
    } finally {
      setCarregando(false);
    }
  }, [grupo, pagina]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  function trocarGrupo(valor) {
    setGrupo(valor);
    setPagina(1);
  }

  async function cancelar(inscricao) {
    try {
      await api.post(`/inscricoes/${inscricao.id}/cancelar`);
      notifySuccess("Inscrição cancelada. A vaga foi liberada.");
      buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
      buscar();
    }
  }

  function cartao(inscricao) {
    const { atividade } = inscricao;
    const selo = SELO[inscricao.situacao] || { rotulo: inscricao.situacao, cor: "gray" };

    return (
      <Card key={inscricao.id} withBorder radius="md" padding="lg" h="100%">
        <Stack gap="sm" h="100%">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <div style={{ minWidth: 0 }}>
              <Title order={4} lineClamp={2} fz={17}>
                {atividade?.titulo}
              </Title>
              <Text size="xs" c="dimmed" truncate>
                {atividade?.ong}
              </Text>
            </div>
            <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
              <Badge color={selo.cor} variant="light" radius="sm">
                {selo.rotulo}
              </Badge>
              <Badge color="clay" variant="light" radius="sm">
                {atividade?.cargaHoraria}h
              </Badge>
            </Stack>
          </Group>

          <Stack gap={5}>
            <Linha icon={IconCalendar}>{formatDate(atividade?.data)}</Linha>
            <Linha icon={IconClock}>
              {atividade?.horaInicio} às {atividade?.horaFim}
            </Linha>
            <Linha icon={IconMapPin}>
              {[atividade?.local, atividade?.cidade].filter(Boolean).join(" · ")}
            </Linha>
          </Stack>

          <Stack gap={6} mt="auto" pt={4}>
            {atividade?.situacao === "em_andamento"
              && inscricao.situacao === "confirmada" && (
              <Button size="compact-sm" leftSection={<IconQrcode size={14} />}
                      onClick={() => navegar("/check-in")}>
                Fazer check-in
              </Button>
            )}
            {inscricao.situacao === "presente"
              && atividade?.situacao === "finalizada" && (
              <Button size="compact-sm" leftSection={<IconCertificate size={14} />}
                      onClick={() => navegar("/meus-certificados")}>
                Ver certificado
              </Button>
            )}
            <Button variant="light" size="compact-sm"
                    onClick={() => navegar(`/atividades/${atividade?.id}`)}>
              Ver atividade
            </Button>

            {inscricao.podeCancelar ? (
              <Button variant="subtle" color="red" size="compact-sm"
                      onClick={() => setCancelando(inscricao)}>
                Cancelar inscrição
              </Button>
            ) : (
              inscricao.situacao === "confirmada" && (
                <Tooltip label="A atividade já começou — o cancelamento fecha no início">
                  <Text size="xs" c="dimmed" ta="center">
                    Cancelamento encerrado
                  </Text>
                </Tooltip>
              )
            )}
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Estudante"
        title="Minhas inscrições"
        subtitle="O que vem pela frente, o que espera resposta e o que já passou."
        action={
          <Button variant="light" leftSection={<IconSearch size={17} />}
                  onClick={() => navegar("/atividades")}>
            Buscar atividades
          </Button>
        }
      />

      <Tabs value={grupo} onChange={trocarGrupo} mb="lg" variant="outline">
        <Tabs.List>
          {GRUPOS.map((item) => (
            <Tabs.Tab key={item.valor} value={item.valor}>
              {item.rotulo}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {carregando ? (
        <Loading label="Carregando inscrições..." />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={IconTicket}
          title="Nada nesta aba"
          description={VAZIO[grupo]}
          action={{ label: "Buscar atividades", onClick: () => navegar("/atividades") }}
        />
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {resultado.itens.map(cartao)}
          </SimpleGrid>

          {resultado.paginas > 1 && (
            <Center>
              <Pagination total={resultado.paginas} value={pagina} onChange={setPagina} />
            </Center>
          )}
        </Stack>
      )}

      <ConfirmarAcao
        aberto={Boolean(cancelando)}
        aoFechar={() => setCancelando(null)}
        titulo="Cancelar inscrição"
        mensagem={`Deseja mesmo cancelar "${cancelando?.atividade?.titulo}"? A vaga será liberada para outra pessoa.`}
        rotuloConfirmar="Cancelar inscrição"
        aoConfirmar={() => cancelar(cancelando)}
      />
    </>
  );
}
