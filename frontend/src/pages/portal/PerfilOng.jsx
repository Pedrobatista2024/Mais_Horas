import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Anchor, Avatar, Button, Card, Container, Group, Paper, SimpleGrid, Stack, Text, Title,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconBrandInstagram, IconBuildingCommunity,
  IconCircleCheckFilled, IconMapPin, IconWorld,
} from "@tabler/icons-react";

import CartaoAtividade from "../../components/atividade/CartaoAtividade";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { formatDate, resolveImage } from "../../utils/format";
import { notifyError } from "../../utils/notify";

/** Só abre link http(s): o endereço vem do perfil, digitado pela própria ONG. */
function linkSeguro(valor) {
  if (!valor) return null;
  const endereco = /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
  try {
    const url = new URL(endereco);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function instagram(valor) {
  if (!valor) return null;
  if (/^https?:\/\//i.test(valor)) return linkSeguro(valor);
  const usuario = valor.replace(/^@/, "").trim();
  return /^[\w.]+$/.test(usuario) ? `https://instagram.com/${usuario}` : null;
}

function Numero({ valor, rotulo }) {
  return (
    <Paper withBorder radius="md" p="md" ta="center">
      <Text fw={900} fz={26} lh={1}>{valor.toLocaleString("pt-BR")}</Text>
      <Text size="xs" c="dimmed" mt={4}>{rotulo}</Text>
    </Paper>
  );
}

/** Perfil público da organização, aberto a qualquer visitante (a partir de T5). */
export default function PerfilOng() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [estado, setEstado] = useState({ id: null, ong: null, falhou: false });

  useEffect(() => {
    let ativo = true;
    api.get(`/portal/ongs/${id}`)
      .then(({ data }) => { if (ativo) setEstado({ id, ong: data, falhou: false }); })
      .catch((erro) => {
        if (!ativo) return;
        if (erro?.response?.status !== 404) {
          notifyError(mensagemDoErro(erro, "Não foi possível carregar a organização"));
        }
        setEstado({ id, ong: null, falhou: true });
      });
    return () => { ativo = false; };
  }, [id]);

  const voltar = (
    <Button variant="subtle" size="compact-sm" w="fit-content" component={Link} to="/ongs"
            leftSection={<IconArrowLeft size={15} />}>
      ONGs parceiras
    </Button>
  );

  if (estado.id !== id) return <Loading label="Carregando organização..." />;

  if (estado.falhou) {
    return (
      <Container size="md" py={{ base: "lg", md: 40 }}>
        <EmptyState icon={IconAlertTriangle} title="Organização não encontrada"
                    description="O endereço pode estar errado, ou a organização não está mais ativa."
                    action={{ label: "Ver ONGs parceiras", onClick: () => navegar("/ongs") }} />
      </Container>
    );
  }

  const { ong } = estado;
  const lugar = [ong.cidade, ong.estado].filter(Boolean).join(" · ");
  const site = linkSeguro(ong.site);
  const insta = instagram(ong.instagram);
  const numeros = [
    { valor: ong.atividadesRealizadas, rotulo: "atividades realizadas" },
    { valor: ong.horasCertificadas, rotulo: "horas certificadas" },
    { valor: ong.atividadesAbertas, rotulo: "vagas abertas" },
  ].filter((n) => n.valor > 0);

  return (
    <Container size="lg" py={{ base: "lg", md: 40 }}>
      <Stack gap="lg">
        {voltar}

        <Card withBorder radius="lg" p={{ base: "lg", sm: "xl" }}>
          <Group gap="lg" align="flex-start" wrap="wrap">
            <Avatar src={resolveImage(ong.logo)} size={96} radius="lg" color="navy">
              <IconBuildingCommunity size={44} />
            </Avatar>
            <Stack gap={6} style={{ flex: 1, minWidth: 220 }}>
              <Group gap={8} wrap="nowrap">
                <Title order={1} fz={{ base: 26, sm: 32 }} lh={1.1}>{ong.nome}</Title>
                {ong.verificada && (
                  <Tooltip label="Organização verificada pela administração">
                    <IconCircleCheckFilled size={24} color="var(--mantine-color-brand-6)"
                                           style={{ flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Group>
              <Group gap="md" c="dimmed" wrap="wrap">
                {lugar && (
                  <Group gap={4} wrap="nowrap">
                    <IconMapPin size={15} />
                    <Text size="sm">{lugar}</Text>
                  </Group>
                )}
                <Text size="sm">Na plataforma desde {formatDate(ong.desde)}</Text>
              </Group>
              {(site || insta) && (
                <Group gap="md" mt={4}>
                  {site && (
                    <Anchor href={site} target="_blank" rel="noopener noreferrer nofollow" size="sm">
                      <Group gap={4} wrap="nowrap"><IconWorld size={15} />Site</Group>
                    </Anchor>
                  )}
                  {insta && (
                    <Anchor href={insta} target="_blank" rel="noopener noreferrer nofollow" size="sm">
                      <Group gap={4} wrap="nowrap"><IconBrandInstagram size={15} />Instagram</Group>
                    </Anchor>
                  )}
                </Group>
              )}
            </Stack>
          </Group>

          {ong.descricao && (
            <Text mt="lg" style={{ whiteSpace: "pre-wrap" }}>{ong.descricao}</Text>
          )}

          {numeros.length > 0 && (
            <SimpleGrid cols={{ base: numeros.length === 1 ? 1 : 2, sm: numeros.length }}
                        spacing="sm" mt="lg">
              {numeros.map((n) => <Numero key={n.rotulo} {...n} />)}
            </SimpleGrid>
          )}
        </Card>

        <div>
          <Title order={2} fz={22} mb="md">Próximas atividades</Title>
          {ong.proximasAtividades.length === 0 ? (
            <EmptyState title="Nenhuma vaga aberta agora"
                        description="Quando a organização publicar uma nova atividade, ela aparece aqui." />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {ong.proximasAtividades.map((atividade) => (
                <CartaoAtividade key={atividade.id} atividade={atividade}
                                 aoClicar={() => navegar(`/vagas/${atividade.id}`)} />
              ))}
            </SimpleGrid>
          )}
        </div>
      </Stack>
    </Container>
  );
}
