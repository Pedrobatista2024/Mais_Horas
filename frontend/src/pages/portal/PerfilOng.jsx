import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Anchor, Avatar, Box, Container, Group, SimpleGrid, Stack, Text, Title, Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconBrandInstagram, IconBuildingCommunity,
  IconRosetteDiscountCheckFilled, IconWorld,
} from "@tabler/icons-react";

import CartaoAtividade from "../../components/atividade/CartaoAtividade";
import { LARGURA_DO_PORTAL } from "../../components/portal/navegacao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import Numeros from "../../components/ui/Numeros";
import { useTitulo } from "../../hooks/useTitulo";
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

/** Perfil público da organização, aberto a qualquer visitante (a partir de T5). */
export default function PerfilOng() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [estado, setEstado] = useState({ id: null, ong: null, falhou: false });
  useTitulo(estado.ong?.nome);

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
    <Anchor component={Link} to="/ongs" size="sm" c="dimmed" display="inline-flex"
            style={{ alignItems: "center", gap: 6 }}>
      <IconArrowLeft size={15} aria-hidden="true" />
      ONGs parceiras
    </Anchor>
  );

  if (estado.id !== id) return <Loading label="Carregando organização…" />;

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
  const lugar = [ong.cidade, ong.estado].filter(Boolean).join(", ");
  const site = linkSeguro(ong.site);
  const insta = instagram(ong.instagram);
  const numeros = [
    { valor: ong.atividadesRealizadas, rotulo: "Atividades realizadas" },
    { valor: ong.horasCertificadas, rotulo: "Horas certificadas" },
    { valor: ong.atividadesAbertas, rotulo: "Vagas abertas" },
  ].filter((n) => n.valor > 0);

  return (
    <Container size={LARGURA_DO_PORTAL} py={{ base: 28, md: 48 }}>
      <Stack gap={36}>
        <Box>
          {voltar}
          <Group gap="lg" align="flex-start" wrap="wrap" mt="md">
            <Avatar src={resolveImage(ong.logo)} size={80} radius="sm" color="navy"
                    alt={`Logo de ${ong.nome}`}>
              <IconBuildingCommunity size={38} />
            </Avatar>
            <Stack gap={6} style={{ flex: 1, minWidth: 220 }}>
              <Group gap={8} wrap="nowrap">
                <Title order={1} fz={{ base: 26, sm: 32 }} lh={1.15}>{ong.nome}</Title>
                {ong.verificada && (
                  <Tooltip label="Organização verificada pela Mais Horas">
                    <IconRosetteDiscountCheckFilled size={22} color="var(--mh-royal)"
                                                   aria-label="verificada"
                                                   style={{ flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Group>
              <Text c="dimmed" size="sm">
                {lugar ? `${lugar}. ` : ""}Na plataforma desde {formatDate(ong.desde)}.
              </Text>
              {(site || insta) && (
                <Group gap="md" mt={2}>
                  {site && (
                    <Anchor href={site} target="_blank" rel="noopener noreferrer nofollow"
                            size="sm" display="inline-flex" style={{ alignItems: "center", gap: 4 }}>
                      <IconWorld size={15} aria-hidden="true" />Site
                    </Anchor>
                  )}
                  {insta && (
                    <Anchor href={insta} target="_blank" rel="noopener noreferrer nofollow"
                            size="sm" display="inline-flex" style={{ alignItems: "center", gap: 4 }}>
                      <IconBrandInstagram size={15} aria-hidden="true" />Instagram
                    </Anchor>
                  )}
                </Group>
              )}
            </Stack>
          </Group>

          {ong.descricao && (
            <Text fz="lg" mt="lg" maw={720} style={{ whiteSpace: "pre-wrap" }}>
              {ong.descricao}
            </Text>
          )}
        </Box>

        {numeros.length > 0 && (
          <Numeros itens={numeros.map((n) => ({ ...n, valor: n.valor.toLocaleString("pt-BR") }))} />
        )}

        <Box component="section">
          <Title order={2} fz="xl" mb="md">Próximas atividades</Title>
          {ong.proximasAtividades.length === 0 ? (
            <EmptyState title="Nenhuma vaga aberta agora"
                        description="Quando a organização publicar uma nova atividade, ela aparece aqui." />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {ong.proximasAtividades.map((atividade) => (
                <CartaoAtividade key={atividade.id} atividade={atividade}
                                 para={`/vagas/${atividade.id}`} />
              ))}
            </SimpleGrid>
          )}
        </Box>
      </Stack>
    </Container>
  );
}
