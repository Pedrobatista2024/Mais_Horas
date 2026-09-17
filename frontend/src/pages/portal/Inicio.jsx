import { Link, useNavigate } from "react-router-dom";
import {
  Badge, Box, Button, Container, Divider, Group, Paper, SimpleGrid, Stack, Text,
  ThemeIcon, Title,
} from "@mantine/core";
import {
  IconArrowRight, IconBuildingCommunity, IconCalendarEvent, IconCertificate,
  IconCircleCheck, IconQrcode, IconSchool, IconSearch, IconShieldCheck, IconUserPlus,
} from "@tabler/icons-react";

import CartaoAtividade from "../../components/atividade/CartaoAtividade";
import CartaoOng from "../../components/portal/CartaoOng";
import ChamadaFinal from "../../components/portal/ChamadaFinal";
import NumerosDeImpacto from "../../components/portal/NumerosDeImpacto";
import Passo from "../../components/portal/Passo";
import Secao from "../../components/portal/Secao";
import { numerosVisiveis } from "../../components/portal/impacto";
import { cadastroComo } from "../../components/portal/navegacao";
import { useConsultaPublica } from "../../hooks/useConsultaPublica";

function Publico({ icone: Icone, cor, titulo, texto, pontos, acao }) {
  return (
    <Paper withBorder radius="lg" p="xl" h="100%">
      <Stack h="100%" gap="md">
        <ThemeIcon size={54} radius="md" variant="light" color={cor}>
          <Icone size={30} />
        </ThemeIcon>
        <div>
          <Title order={3} fz="xl" mb={6}>{titulo}</Title>
          <Text c="dimmed" size="sm">{texto}</Text>
        </div>
        <Stack gap={8} style={{ flex: 1 }}>
          {pontos.map((ponto) => (
            <Group key={ponto} gap={8} wrap="nowrap" align="flex-start">
              <IconCircleCheck size={18} color={`var(--mantine-color-${cor}-6)`}
                               style={{ flexShrink: 0, marginTop: 1 }} />
              <Text size="sm">{ponto}</Text>
            </Group>
          ))}
        </Stack>
        <Button variant="light" color={cor} component={Link} to={acao.para}
                rightSection={<IconArrowRight size={16} />}>
          {acao.rotulo}
        </Button>
      </Stack>
    </Paper>
  );
}

/**
 * T1 — Início do portal.
 *
 * Todo número desta página vem da API. Enquanto a plataforma não tiver
 * movimento, as seções de vagas, parceiras e impacto simplesmente não aparecem.
 */
export default function Inicio() {
  const navegar = useNavigate();
  const resumo = useConsultaPublica("/portal/resumo");
  const vagas = useConsultaPublica("/atividades?tamanho=6");
  const parceiras = useConsultaPublica("/portal/ongs?tamanho=6");

  const abertas = resumo?.atividadesAbertas ?? 0;

  return (
    <>
      <Box className="mh-hero">
        <div className="mh-hero-orb" style={{ width: 460, height: 460, right: -120, top: -160 }} />
        <div className="mh-hero-orb" style={{ width: 300, height: 300, right: 60, top: 40 }} />
        <Container size="xl" py={{ base: 48, md: 80 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48} style={{ alignItems: "center" }}>
            <Stack gap="lg">
              <Badge size="lg" radius="sm" color="clay" variant="filled" w="fit-content">
                Conectando estudantes e ONGs
              </Badge>
              <Title className="mh-display" c="white" fz={{ base: 36, sm: 52, md: 58 }}>
                Suas horas de extensão, finalmente{" "}
                <Text span inherit c="clay.4">sem burocracia</Text>.
              </Title>
              <Text c="rgba(255,255,255,0.9)" fz={{ base: "md", md: "lg" }} maw={520}>
                Encontre vagas de voluntariado como quem busca uma oportunidade, participe
                e receba um certificado que qualquer pessoa confere pelo QR Code.
              </Text>
              <Group gap="md" mt="xs">
                <Button size="lg" color="clay" leftSection={<IconSchool size={20} />}
                        component={Link} to={cadastroComo("estudante")}>
                  Sou estudante
                </Button>
                <Button size="lg" variant="white" color="dark"
                        leftSection={<IconBuildingCommunity size={20} />}
                        component={Link} to={cadastroComo("ong")}>
                  Sou ONG
                </Button>
              </Group>
              <Group gap="lg">
                <Button variant="subtle" color="gray.0" px={0} component={Link}
                        to="/como-funciona" rightSection={<IconArrowRight size={16} />}>
                  Como funciona
                </Button>
                <Button variant="subtle" color="gray.0" px={0} component={Link}
                        to="/verificar" leftSection={<IconShieldCheck size={16} />}>
                  Verificar certificado
                </Button>
              </Group>
            </Stack>

            <Box visibleFrom="md" style={{ position: "relative", minHeight: 420 }}>
              <Box component="img" src="/hero-voluntariado.jpg"
                   alt="Voluntários sorrindo em uma ação social"
                   className="mh-hero-photo" style={{ width: "100%", height: 420 }} />

              {abertas > 0 && (
                <Paper radius="xl" px="md" py={8} shadow="lg" component={Link} to="/vagas"
                       style={{ position: "absolute", top: 22, left: 8, zIndex: 2,
                                textDecoration: "none", color: "inherit" }}>
                  <Group gap={8} wrap="nowrap">
                    <ThemeIcon size={30} radius="xl" color="brand" variant="light">
                      <IconUserPlus size={16} />
                    </ThemeIcon>
                    <div>
                      <Text fw={800} fz="sm" lh={1}>
                        {abertas} {abertas === 1 ? "vaga aberta" : "vagas abertas"}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.3}>agora na plataforma</Text>
                    </div>
                  </Group>
                </Paper>
              )}

              <Paper radius="lg" p="md" shadow="xl"
                     style={{ position: "absolute", bottom: -24, right: -20, width: 290 }}>
                <Group mb="sm" wrap="nowrap">
                  <ThemeIcon size={42} radius="md" color="brand" variant="light">
                    <IconShieldCheck size={24} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800} lh={1.1}>Certificado válido</Text>
                    <Text size="xs" c="dimmed">Assinado digitalmente</Text>
                  </div>
                </Group>
                <Divider mb="sm" />
                <Text size="sm">Nome do aluno · 4h</Text>
                <Group gap={8} mt="sm" wrap="nowrap">
                  <IconQrcode size={18} color="var(--mantine-color-navy-6)" />
                  <Text size="xs" c="dimmed">Ilustração — o real se confere pelo QR</Text>
                </Group>
              </Paper>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      <Secao eyebrow="Como funciona" titulo="Da vaga ao certificado, em 4 passos"
             subtitulo="Sem planilha, sem lista de papel e sem certificado que qualquer um edita.">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <Passo icone={IconCalendarEvent} numero="1" titulo="A ONG publica" cor="navy">
            Cria a vaga com data, local, carga horária e número de participantes.
          </Passo>
          <Passo icone={IconSearch} numero="2" titulo="O aluno se inscreve">
            Encontra a vaga como uma oferta de trabalho e se inscreve com um clique.
          </Passo>
          <Passo icone={IconQrcode} numero="3" titulo="Presença por QR" cor="clay">
            No evento, escaneia um QR que muda a cada 30 segundos — foto não serve.
          </Passo>
          <Passo icone={IconCertificate} numero="4" titulo="Certificado assinado">
            A ONG confirma a presença e o certificado sai com assinatura digital.
          </Passo>
        </SimpleGrid>
        <Group justify="center" mt="xl">
          <Button variant="light" component={Link} to="/como-funciona"
                  rightSection={<IconArrowRight size={16} />}>
            Ver a jornada completa
          </Button>
        </Group>
      </Secao>

      <Secao alternada eyebrow="Para quem é" titulo="Todo mundo ganha">
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Publico icone={IconSchool} cor="brand" titulo="Estudantes"
                   texto="Encontre voluntariado e comprove suas horas sem dor de cabeça."
                   pontos={["Vagas num só lugar", "Inscrição com um clique",
                            "Certificados sempre à mão"]}
                   acao={{ para: "/para-estudantes", rotulo: "Para estudantes" }} />
          <Publico icone={IconBuildingCommunity} cor="navy" titulo="ONGs"
                   texto="Divulgue ações e gerencie voluntários sem planilha."
                   pontos={["Publique vagas em minutos", "Presença validada no celular",
                            "Certificados emitidos na hora"]}
                   acao={{ para: "/para-ongs", rotulo: "Para ONGs" }} />
          <Publico icone={IconShieldCheck} cor="clay" titulo="Instituições de ensino"
                   texto="Receba comprovações que se conferem sozinhas."
                   pontos={["Código único por certificado", "Verificação pública pelo QR",
                            "Adulteração detectada na hora"]}
                   acao={{ para: "/verificar", rotulo: "Verificar um certificado" }} />
        </SimpleGrid>
      </Secao>

      {vagas?.itens?.length > 0 && (
        <Secao eyebrow="Vagas abertas" titulo="Para participar agora"
               subtitulo="As próximas atividades publicadas pelas organizações.">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {vagas.itens.map((atividade) => (
              <CartaoAtividade key={atividade.id} atividade={atividade}
                               aoClicar={() => navegar(`/vagas/${atividade.id}`)} />
            ))}
          </SimpleGrid>
          <Group justify="center" mt="xl">
            <Button component={Link} to="/vagas" rightSection={<IconArrowRight size={16} />}>
              Ver todas as vagas
            </Button>
          </Group>
        </Secao>
      )}

      {parceiras?.itens?.length > 0 && (
        <Secao alternada eyebrow="ONGs parceiras" titulo="Quem já está aqui">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {parceiras.itens.map((ong) => (
              <CartaoOng key={ong.id} ong={ong} aoClicar={() => navegar(`/ongs/${ong.id}`)} />
            ))}
          </SimpleGrid>
          <Group justify="center" mt="xl">
            <Button variant="light" color="navy" component={Link} to="/ongs"
                    rightSection={<IconArrowRight size={16} />}>
              Conhecer todas
            </Button>
          </Group>
        </Secao>
      )}

      {numerosVisiveis(resumo).length > 0 && (
        <Secao eyebrow="Impacto" titulo="O que já aconteceu por aqui"
               subtitulo="Números contados direto da plataforma, sem arredondar para cima.">
          <NumerosDeImpacto resumo={resumo} />
        </Secao>
      )}

      <ChamadaFinal />
    </>
  );
}
