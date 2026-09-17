import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Divider, Grid, Group, Stack, Text, Title, Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconCalendar, IconCheck, IconClock,
  IconMapPin, IconShare, IconUsers,
} from "@tabler/icons-react";

import BotaoInscricao from "../../components/atividade/BotaoInscricao";
import SituacaoBadge from "../../components/atividade/SituacaoBadge";
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
 * E3 — Detalhe da atividade.
 *
 * Mostra a **contagem** de inscritos, nunca os nomes (D21): expor curso e
 * instituição de terceiros a qualquer colega vazaria dado de quem não
 * consentiu. A ONG vê a lista completa na tela dela.
 */
export default function DetalheAtividade() {
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
    try {
      await navigator.clipboard.writeText(window.location.href);
      notifySuccess("Link copiado");
    } catch {
      notifyError("Seu navegador não deixou copiar o link");
    }
  }

  if (carregando) return <Loading label="Carregando atividade..." />;

  if (!atividade) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title="Atividade não encontrada"
        description="Ela pode ter sido cancelada ou o endereço está errado."
        action={{ label: "Ver outras atividades", onClick: () => navegar("/atividades") }}
      />
    );
  }

  const encerrada = ["cancelada", "finalizada"].includes(atividade.situacao);
  const mapa = `https://www.google.com/maps/search/?api=1&query=${
    encodeURIComponent([atividade.local, atividade.cidade, atividade.estado]
      .filter(Boolean).join(", "))
  }`;

  return (
    <Stack gap="lg" maw={900}>
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar("/atividades")}>
        Voltar à vitrine
      </Button>

      <Stack gap="xs">
        <Group gap="xs" wrap="wrap">
          <SituacaoBadge situacao={atividade.situacao} size="md" />
          <Badge color="clay" variant="light" radius="sm" size="md">
            {atividade.cargaHoraria}h de atividade
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
        <Group gap={5}>
          <Text c="dimmed">por {atividade.ong?.nome}</Text>
          {atividade.ong?.verificada && (
            <Tooltip label="Organização verificada pela administração">
              <IconCheck size={15} color="var(--mantine-color-brand-6)" />
            </Tooltip>
          )}
        </Group>
      </Stack>

      {atividade.editadaPorAdminEm && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
          Esta atividade foi editada pela administração da plataforma em{" "}
          {new Date(atividade.editadaPorAdminEm).toLocaleDateString("pt-BR")}. Confira
          data, horário e local antes de ir.
        </Alert>
      )}

      {atividade.situacao === "cancelada" && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
          Esta atividade foi cancelada pela organização.
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
            <Dado icon={IconUsers} rotulo="Inscrições">
              {atividade.vagasOcupadas}{" "}
              {atividade.vagasOcupadas === 1 ? "pessoa inscrita" : "pessoas inscritas"}
              {" · "}
              {atividade.lotada
                ? "vagas esgotadas"
                : `${atividade.vagasRestantes} ${
                    atividade.vagasRestantes === 1 ? "vaga" : "vagas"} restantes`}
            </Dado>
          </Grid.Col>
        </Grid>

        <Divider my="lg" />

        <Stack gap="xs">
          <Text fw={700}>Sobre a atividade</Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{atividade.descricao}</Text>
        </Stack>

        <Divider my="lg" />

        <Group gap="sm" wrap="wrap">
          <BotaoInscricao atividade={atividade} aoMudar={buscar} />
          {atividade.local && (
            <Button component="a" href={mapa} target="_blank" rel="noreferrer"
                    variant="light" leftSection={<IconMapPin size={16} />}>
              Como chegar
            </Button>
          )}
          <Button variant="subtle" leftSection={<IconShare size={16} />}
                  onClick={compartilhar}>
            Compartilhar
          </Button>
        </Group>

        {encerrada && (
          <Text size="xs" c="dimmed" mt="sm">
            As inscrições para esta atividade estão encerradas.
          </Text>
        )}
      </Card>
    </Stack>
  );
}
