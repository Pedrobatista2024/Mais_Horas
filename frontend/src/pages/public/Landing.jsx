import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Group,
  Button,
  Title,
  Text,
  Stack,
  SimpleGrid,
  Paper,
  ThemeIcon,
  Badge,
  Anchor,
  Divider,
} from "@mantine/core";
import {
  IconSearch,
  IconUserPlus,
  IconQrcode,
  IconCertificate,
  IconCalendarEvent,
  IconShieldCheck,
  IconBuildingCommunity,
  IconSchool,
  IconArrowRight,
  IconClock,
  IconMapPin,
} from "@tabler/icons-react";

import BrandMark from "../../components/ui/BrandMark";
import BrandIcon from "../../components/ui/BrandIcon";

function Step({ icon: Icon, n, title, desc, color }) {
  return (
    <Paper withBorder radius="lg" p="lg" className="mh-card-hover" h="100%">
      <Group justify="space-between" mb="sm">
        <ThemeIcon size={48} radius="md" variant="light" color={color}>
          <Icon size={26} />
        </ThemeIcon>
        <Text fw={900} fz={28} c="ink.2">
          {n}
        </Text>
      </Group>
      <Text fw={800} fz="lg" mb={4}>
        {title}
      </Text>
      <Text c="dimmed" size="sm">
        {desc}
      </Text>
    </Paper>
  );
}

function Audience({ icon: Icon, title, desc, points, color }) {
  return (
    <Paper withBorder radius="lg" p="xl" h="100%">
      <ThemeIcon size={54} radius="md" variant="light" color={color} mb="md">
        <Icon size={30} />
      </ThemeIcon>
      <Title order={3} fz="xl" mb={6}>
        {title}
      </Title>
      <Text c="dimmed" size="sm" mb="md">
        {desc}
      </Text>
      <Stack gap={8}>
        {points.map((p) => (
          <Group key={p} gap={8} wrap="nowrap" align="flex-start">
            <ThemeIcon size={20} radius="xl" color={color} variant="filled" mt={2}>
              <IconShieldCheck size={12} />
            </ThemeIcon>
            <Text size="sm">{p}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <Box className="mh-landing">
      {/* Barra fina no topo */}
      <Box className="mh-strip">
        <Container size="xl">
          <Group h={34} justify="space-between">
            <Text size="xs" fw={600}>
              Plataforma de horas de extensão · UniC
            </Text>
            <Group gap="lg" visibleFrom="sm">
              <Anchor c="inherit" underline="never" size="xs" fw={600} onClick={() => navigate("/login")}>
                Verificar certificado
              </Anchor>
              <Anchor c="inherit" underline="never" size="xs" fw={600} onClick={() => navigate("/login")}>
                Entrar
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Header */}
      <Box bg="white" style={{ borderBottom: "1px solid #e6eaf1", position: "sticky", top: 0, zIndex: 50 }}>
        <Container size="xl">
          <Group h={72} justify="space-between">
            <BrandMark onClick={() => navigate("/")} />
            <Group gap="sm" visibleFrom="xs">
              <Button variant="subtle" color="ink" onClick={() => navigate("/login")}>
                Entrar
              </Button>
              <Button color="brand" onClick={() => navigate("/register")}>
                Criar conta
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* HERO */}
      <Box className="mh-hero">
        <div className="mh-hero-orb" style={{ width: 460, height: 460, right: -120, top: -160 }} />
        <div className="mh-hero-orb" style={{ width: 300, height: 300, right: 60, top: 40 }} />
        <Container size="xl" py={{ base: 48, md: 80 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48} style={{ alignItems: "center" }}>
            {/* Texto */}
            <Stack gap="lg">
              <Badge size="lg" radius="sm" color="clay" variant="filled" w="fit-content">
                Conectando estudantes e ONGs
              </Badge>
              <Title className="mh-display" c="white" fz={{ base: 38, sm: 52, md: 58 }}>
                Suas horas de extensão, finalmente{" "}
                <Text span inherit c="clay.4">
                  sem burocracia
                </Text>
                .
              </Title>
              <Text c="rgba(255,255,255,0.9)" fz={{ base: "md", md: "lg" }} maw={520}>
                Encontre vagas de voluntariado como quem busca uma oportunidade, participe e
                receba um certificado validado por QR Code. Tudo em um só lugar.
              </Text>
              <Group gap="md" mt="xs">
                <Button
                  size="lg"
                  color="clay"
                  leftSection={<IconSchool size={20} />}
                  onClick={() => navigate("/register")}
                >
                  Sou estudante
                </Button>
                <Button
                  size="lg"
                  variant="white"
                  color="dark"
                  leftSection={<IconBuildingCommunity size={20} />}
                  onClick={() => navigate("/register")}
                >
                  Sou ONG
                </Button>
              </Group>
              <Group gap="xl" mt="md">
                <div>
                  <Text fw={900} fz={26} c="white">
                    100%
                  </Text>
                  <Text size="xs" c="rgba(255,255,255,0.75)">
                    digital, sem papel
                  </Text>
                </div>
                <div>
                  <Text fw={900} fz={26} c="white">
                    QR Code
                  </Text>
                  <Text size="xs" c="rgba(255,255,255,0.75)">
                    presença validada
                  </Text>
                </div>
                <div>
                  <Text fw={900} fz={26} c="white">
                    Verificável
                  </Text>
                  <Text size="xs" c="rgba(255,255,255,0.75)">
                    certificado anti-fraude
                  </Text>
                </div>
              </Group>
            </Stack>

            {/* Foto real + card de certificado sobreposto */}
            <Box visibleFrom="md" style={{ position: "relative", minHeight: 420 }}>
              <Box
                component="img"
                src="/hero-voluntariado.jpg"
                alt="Voluntários sorrindo em uma ação social"
                className="mh-hero-photo"
                style={{ width: "100%", height: 420 }}
              />

              {/* badge flutuante topo-esquerda */}
              <Paper
                radius="xl"
                px="md"
                py={8}
                shadow="lg"
                style={{ position: "absolute", top: 22, left: 8, zIndex: 2 }}
              >
                <Group gap={8} wrap="nowrap">
                  <ThemeIcon size={30} radius="xl" color="brand" variant="light">
                    <IconUserPlus size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800} fz="sm" lh={1}>
                      +120 vagas
                    </Text>
                    <Text size="xs" c="dimmed" lh={1}>
                      abertas agora
                    </Text>
                  </div>
                </Group>
              </Paper>

              {/* card certificado flutuante embaixo */}
              <Paper
                radius="lg"
                p="md"
                shadow="xl"
                style={{ position: "absolute", bottom: -24, right: -20, width: 290 }}
              >
                <Group mb="sm" wrap="nowrap">
                  <ThemeIcon size={42} radius="md" color="brand" variant="light">
                    <IconShieldCheck size={24} />
                  </ThemeIcon>
                  <div>
                    <Text fw={800} lh={1.1}>
                      Certificado válido
                    </Text>
                    <Text size="xs" c="dimmed">
                      Emitido pela Mais Horas
                    </Text>
                  </div>
                </Group>
                <Divider mb="sm" />
                <Text size="sm">
                  <b>Maria Aluna</b> · 4h
                </Text>
                <Group gap={8} mt="sm" wrap="nowrap">
                  <IconQrcode size={18} color="#1f47c9" />
                  <Text size="xs" ff="monospace" c="dimmed">
                    649ece45c025395c
                  </Text>
                </Group>
              </Paper>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      {/* COMO FUNCIONA */}
      <Container size="xl" py={{ base: 48, md: 72 }}>
        <Stack align="center" gap={6} mb="xl">
          <Text tt="uppercase" fw={800} c="brand.7" size="sm">
            Como funciona
          </Text>
          <Title order={2} ta="center">
            Da vaga ao certificado, em 4 passos
          </Title>
          <Text c="dimmed" ta="center" maw={560}>
            Um fluxo simples que elimina planilha, papel e retrabalho — para o aluno e para a ONG.
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <Step icon={IconCalendarEvent} n="1" title="A ONG publica" desc="Cria a vaga com data, local, carga horária e número de participantes." color="navy" />
          <Step icon={IconSearch} n="2" title="O aluno encontra" desc="Busca oportunidades como ofertas de trabalho e se inscreve com um clique." color="brand" />
          <Step icon={IconQrcode} n="3" title="Presença por QR" desc="No evento, a presença é validada digitalmente — sem lista de papel." color="clay" />
          <Step icon={IconCertificate} n="4" title="Certificado pronto" desc="O sistema gera um certificado com código verificável publicamente." color="brand" />
        </SimpleGrid>
      </Container>

      {/* PARA QUEM É */}
      <Box className="mh-section-alt">
        <Container size="xl" py={{ base: 48, md: 72 }}>
          <Stack align="center" gap={6} mb="xl">
            <Text tt="uppercase" fw={800} c="brand.7" size="sm">
              Para quem é
            </Text>
            <Title order={2} ta="center">
              Todo mundo ganha
            </Title>
          </Stack>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Audience
              icon={IconSchool}
              color="brand"
              title="Estudantes"
              desc="Encontre voluntariado e comprove suas horas sem dor de cabeça."
              points={["Oportunidades num só lugar", "Inscrição com um clique", "Certificados sempre à mão"]}
            />
            <Audience
              icon={IconBuildingCommunity}
              color="navy"
              title="ONGs"
              desc="Divulgue ações e gerencie voluntários sem planilha."
              points={["Publique vagas em minutos", "Valide presença digitalmente", "Emita certificados em segundos"]}
            />
            <Audience
              icon={IconShieldCheck}
              color="clay"
              title="Faculdades"
              desc="Receba comprovações confiáveis e verificáveis."
              points={["Certificado com código único", "Verificação pública por QR", "Sem risco de fraude"]}
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA FINAL */}
      <Box className="mh-hero">
        <Container size="xl" py={{ base: 48, md: 64 }}>
          <Group justify="space-between" align="center" wrap="wrap" gap="lg">
            <Stack gap={4}>
              <Title order={2} c="white" className="mh-display">
                Comece a somar horas que transformam
              </Title>
              <Text c="rgba(255,255,255,0.9)">
                Crie sua conta gratuita e participe da primeira atividade hoje.
              </Text>
            </Stack>
            <Group gap="md">
              <Button size="lg" color="clay" onClick={() => navigate("/register")} rightSection={<IconArrowRight size={18} />}>
                Criar conta grátis
              </Button>
              <Button size="lg" variant="white" color="dark" onClick={() => navigate("/login")}>
                Já tenho conta
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* FOOTER */}
      <Box className="mh-footer">
        <Container size="xl" py="xl">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
            <Stack gap="xs" maw={320}>
              <Group gap={10}>
                <BrandIcon size={36} style={{ borderRadius: 10 }} />
                <Text fw={900} fz="lg" c="white">
                  Mais
                  <Text span inherit c="brand.3">
                    Horas
                  </Text>
                </Text>
              </Group>
              <Text size="sm" c="rgba(255,255,255,0.7)">
                Conectando estudantes e ONGs por horas que transformam. Projeto Integrador I — UniC.
              </Text>
            </Stack>
            <Group gap={64} align="flex-start" wrap="wrap">
              <Stack gap={6}>
                <Text fw={700} c="white" size="sm">
                  Plataforma
                </Text>
                <Anchor c="rgba(255,255,255,0.75)" size="sm" onClick={() => navigate("/login")}>
                  Entrar
                </Anchor>
                <Anchor c="rgba(255,255,255,0.75)" size="sm" onClick={() => navigate("/register")}>
                  Criar conta
                </Anchor>
              </Stack>
              <Stack gap={6}>
                <Text fw={700} c="white" size="sm">
                  Equipe
                </Text>
                <Text c="rgba(255,255,255,0.75)" size="sm">
                  Pedro Batista
                </Text>
                <Text c="rgba(255,255,255,0.75)" size="sm">
                  Ismael Brandão
                </Text>
                <Text c="rgba(255,255,255,0.75)" size="sm">
                  Antônio Yarlen
                </Text>
              </Stack>
            </Group>
          </Group>
          <Divider my="lg" color="rgba(255,255,255,0.12)" />
          <Text size="xs" c="rgba(255,255,255,0.6)">
            © {new Date().getFullYear()} Mais Horas · Centro Universitário Cearense (UniC)
          </Text>
        </Container>
      </Box>
    </Box>
  );
}
