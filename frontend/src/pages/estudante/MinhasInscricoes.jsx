import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Badge, Box, Button, Center, Group, Pagination, Stack, Tabs, Text,
} from "@mantine/core";
import { IconCertificate, IconQrcode, IconTicket } from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import DataBloco from "../../components/ui/DataBloco";
import EmptyState from "../../components/ui/EmptyState";
import Horas from "../../components/ui/Horas";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { formatHorario } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

const TAMANHO = 12;

const GRUPOS = [
  { valor: "proximas", rotulo: "Próximas" },
  { valor: "aguardando", rotulo: "Aguardando a ONG" },
  { valor: "historico", rotulo: "Histórico" },
];

const VAZIO = {
  proximas: ["Nada marcado pela frente", "Quando você se inscrever, a atividade aparece aqui."],
  aguardando: ["Nenhum pedido esperando resposta",
               "Atividades com aprovação ficam aqui até a ONG decidir."],
  historico: ["O histórico ainda está vazio",
              "Atividades que já aconteceram ou foram canceladas ficam aqui."],
};

/**
 * Selos de `E4`.
 *
 * `recusada` vira "Não aprovada" e **não traz motivo** (D8): a ONG recusa sem
 * justificar, e inventar um texto aqui seria pior que o silêncio. "Confirmada"
 * não ganha selo: é o normal da aba "Próximas".
 */
const SELO = {
  pendente: { rotulo: "Aguardando a ONG", cor: "violet" },
  presente: { rotulo: "Presença confirmada", cor: "teal" },
  ausente: { rotulo: "Falta registrada", cor: "gray" },
  recusada: { rotulo: "Não aprovada", cor: "red" },
  cancelada: { rotulo: "Cancelada por você", cor: "gray" },
};

/** E4 — Minhas inscrições. A aba fica na URL (`?grupo=historico`). */
export default function MinhasInscricoes() {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const grupo = GRUPOS.some((g) => g.valor === params.get("grupo"))
    ? params.get("grupo") : "proximas";
  const pagina = Number(params.get("pagina")) || 1;

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

  function irPara(mudancas) {
    const novo = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([k, v]) => novo.set(k, String(v)));
    if (!("pagina" in mudancas)) novo.delete("pagina");
    setParams(novo, { replace: true });
  }

  async function cancelar(inscricao) {
    try {
      await api.post(`/inscricoes/${inscricao.id}/cancelar`);
      notifySuccess("Inscrição cancelada. A vaga voltou para a lista.");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
    } finally {
      buscar();
    }
  }

  function linha(inscricao) {
    const { atividade } = inscricao;
    const selo = SELO[inscricao.situacao];
    const agora = atividade?.situacao === "em_andamento" && inscricao.situacao === "confirmada";
    const comCertificado = inscricao.situacao === "presente"
      && atividade?.situacao === "finalizada";

    return (
      <Group key={inscricao.id} className="mh-linha" gap="md" wrap="nowrap"
             align="flex-start" pos="relative">
        <DataBloco data={atividade?.data} />

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={600} component={Link} to={`/atividades/${atividade?.id}`}
                  className="mh-link-titulo">
              {atividade?.titulo}
            </Text>
            {agora && <Badge color="green">Acontecendo agora</Badge>}
            {selo && <Badge color={selo.cor}>{selo.rotulo}</Badge>}
          </Group>
          <Text size="sm" c="dimmed" lineClamp={1}>{atividade?.ong}</Text>
          <Text size="sm" c="dimmed" lineClamp={1}>
            {formatHorario(atividade?.horaInicio, atividade?.horaFim)}, {atividade?.local}
          </Text>

          <Group gap="xs" mt="sm" className="mh-acima-do-link">
            {agora && (
              <Button size="xs" leftSection={<IconQrcode size={15} />}
                      onClick={() => navegar("/check-in")}>
                Fazer check-in
              </Button>
            )}
            {comCertificado && (
              <Button size="xs" variant="default" leftSection={<IconCertificate size={15} />}
                      onClick={() => navegar("/meus-certificados")}>
                Ver certificado
              </Button>
            )}
            {inscricao.podeCancelar && (
              <Button size="xs" variant="subtle" color="gray"
                      onClick={() => setCancelando(inscricao)}>
                Cancelar inscrição
              </Button>
            )}
          </Group>
        </Box>

        <Horas valor={atividade?.cargaHoraria} />
      </Group>
    );
  }

  const [tituloVazio, textoVazio] = VAZIO[grupo];

  return (
    <>
      <PageHeader
        title="Minhas inscrições"
        action={
          <Button variant="default" component={Link} to="/atividades">
            Buscar atividades
          </Button>
        }
      />

      <Tabs value={grupo} onChange={(v) => irPara({ grupo: v })} mb="lg">
        <Tabs.List>
          {GRUPOS.map((item) => (
            <Tabs.Tab key={item.valor} value={item.valor}>
              {item.rotulo}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {carregando ? (
        <Loading label="Carregando inscrições…" />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={IconTicket}
          title={tituloVazio}
          description={textoVazio}
          action={grupo === "proximas"
            ? { label: "Buscar atividades", onClick: () => navegar("/atividades") }
            : undefined}
        />
      ) : (
        <Stack gap="lg">
          <Box className="mh-lista">{resultado.itens.map(linha)}</Box>

          {resultado.paginas > 1 && (
            <Center>
              <Pagination total={resultado.paginas} value={pagina}
                          onChange={(p) => irPara({ pagina: p })} />
            </Center>
          )}
        </Stack>
      )}

      <ConfirmarAcao
        aberto={Boolean(cancelando)}
        aoFechar={() => setCancelando(null)}
        titulo="Cancelar inscrição"
        mensagem={`Sua vaga em "${cancelando?.atividade?.titulo}" volta para a lista e outra pessoa pode ficar com ela.`}
        rotuloConfirmar="Cancelar inscrição"
        rotuloVoltar="Manter inscrição"
        aoConfirmar={() => cancelar(cancelando)}
      />
    </>
  );
}
