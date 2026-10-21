import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Anchor, Badge, Box, Button, Grid, Group, Stack, Text, Title, Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle, IconMapPin, IconQrcode, IconRosetteDiscountCheckFilled, IconShare,
} from "@tabler/icons-react";

import BotaoInscricao from "../../components/atividade/BotaoInscricao";
import SituacaoBadge from "../../components/atividade/SituacaoBadge";
import EmptyState from "../../components/ui/EmptyState";
import Horas from "../../components/ui/Horas";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { formatDateLong, formatHorario } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

/** Uma linha da ficha: rótulo pequeno em cima, valor embaixo. */
function Dado({ rotulo, children }) {
  return (
    <Box>
      <Text size="sm" c="dimmed">{rotulo}</Text>
      <Text fw={500}>{children}</Text>
    </Box>
  );
}

function textoDeInscritos({ vagasOcupadas, vagasRestantes, lotada }) {
  const inscritos = `${vagasOcupadas} ${vagasOcupadas === 1 ? "pessoa inscrita" : "pessoas inscritas"}`;
  if (lotada) return `${inscritos}, lotada`;
  return `${inscritos}, ${vagasRestantes} ${vagasRestantes === 1 ? "vaga livre" : "vagas livres"}`;
}

/**
 * E3 — Detalhe da atividade.
 *
 * Página de evento: à esquerda o que é, à direita a ficha com quando, onde,
 * quantas horas e o botão. No celular a ficha vem logo depois do título,
 * antes da descrição — é ela que decide se a pessoa vai.
 *
 * Mostra a **contagem** de inscritos, nunca os nomes (D21).
 */
export default function DetalheAtividade({ base = "/atividades" }) {
  const { id } = useParams();
  const navegar = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [atividade, setAtividade] = useState(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/atividades/${id}`);
      setAtividade(data);
    } catch (erro) {
      setAtividade(null);
      // O 404 já é explicado pela própria tela — avisar de novo seria ruído.
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

  async function compartilhar() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: atividade.titulo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      notifySuccess("Link copiado");
    } catch (erro) {
      if (erro?.name !== "AbortError") notifyError("Seu navegador não deixou copiar o link");
    }
  }

  if (carregando) return <Loading label="Carregando atividade…" />;

  if (!atividade) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title="Atividade não encontrada"
        description="Ela pode ter sido cancelada, ou o endereço está errado."
        action={{ label: "Ver outras atividades", onClick: () => navegar(base) }}
      />
    );
  }

  const endereco = [atividade.local, atividade.cidade, atividade.estado]
    .filter(Boolean).join(", ");
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
  const podeCheckin = atividade.situacao === "em_andamento"
    && atividade.minhaInscricao?.situacao === "confirmada";

  const ficha = (
    <Box className="mh-bloco" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>Carga horária</Text>
          <Horas valor={atividade.cargaHoraria} style={{ fontSize: "0.9375rem" }} />
        </Group>
        <Dado rotulo="Quando">
          {formatDateLong(atividade.data)}
          <br />
          {formatHorario(atividade.horaInicio, atividade.horaFim)}
        </Dado>
        <Dado rotulo="Onde">{endereco}</Dado>
        <Dado rotulo="Vagas">{textoDeInscritos(atividade)}</Dado>

        <Stack gap="xs" pt={4}>
          {podeCheckin && (
            <Button component={Link} to="/check-in" leftSection={<IconQrcode size={17} />}>
              Fazer check-in
            </Button>
          )}
          <BotaoInscricao atividade={atividade} aoMudar={buscar} />
          <Group gap="xs" grow>
            {atividade.local && (
              <Button component="a" href={mapa} target="_blank" rel="noreferrer" px="xs"
                      variant="default" leftSection={<IconMapPin size={16} />}>
                Como chegar
              </Button>
            )}
            <Button variant="default" leftSection={<IconShare size={16} />} px="xs"
                    onClick={compartilhar}>
              Compartilhar
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <>
      <PageHeader
        voltar={{ para: base, rotulo: base === "/vagas" ? "Vagas abertas" : "Buscar atividades" }}
        title={atividade.titulo}
        badge={atividade.situacao !== "publicada"
          ? <SituacaoBadge situacao={atividade.situacao} size="lg" /> : null}
      >
        <Group gap={6} mt={6}>
          <Text c="dimmed">
            por{" "}
            <Anchor component={Link} to={`/ongs/${atividade.ong?.id}`} inherit>
              {atividade.ong?.nome}
            </Anchor>
          </Text>
          {atividade.ong?.verificada && (
            <Tooltip label="Organização verificada pela Mais Horas">
              <IconRosetteDiscountCheckFilled size={16} color="var(--mh-royal)"
                                             aria-label="verificada" />
            </Tooltip>
          )}
          {atividade.exigeAprovacao && <Badge color="gray">Com aprovação da ONG</Badge>}
        </Group>
      </PageHeader>

      <Stack gap="md" mb="lg">
        {atividade.editadaPorAdminEm && (
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            A administração da plataforma editou esta atividade em{" "}
            {new Date(atividade.editadaPorAdminEm).toLocaleDateString("pt-BR")}. Confira
            data, horário e local antes de ir.
          </Alert>
        )}
        {atividade.situacao === "cancelada" && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />}>
            A organização cancelou esta atividade.
          </Alert>
        )}
      </Stack>

      <Grid gutter={{ base: "lg", md: 40 }}>
        <Grid.Col span={{ base: 12, md: 4 }} order={{ base: 1, md: 2 }}>
          <Box style={{ position: "sticky", top: 84 }}>{ficha}</Box>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }} order={{ base: 2, md: 1 }}>
          <Box className="mh-bloco" p={{ base: "md", sm: "lg" }}>
            <Title order={2} fz="lg" mb="xs">Sobre a atividade</Title>
            <Text maw={680} style={{ whiteSpace: "pre-wrap" }}>{atividade.descricao}</Text>
          </Box>
        </Grid.Col>
      </Grid>
    </>
  );
}
