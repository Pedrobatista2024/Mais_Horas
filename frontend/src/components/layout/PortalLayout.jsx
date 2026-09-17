import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Anchor, Box, Burger, Button, Container, Divider, Drawer, Group, NavLink, Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLayoutDashboard, IconShieldCheck } from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { cadastroComo, LINKS_DO_PORTAL } from "../portal/navegacao";
import BrandIcon from "../ui/BrandIcon";
import BrandMark from "../ui/BrandMark";

function ativo(local, para) {
  return local.pathname === para || local.pathname.startsWith(`${para}/`);
}

/** Casca do portal público (T1 a T5 e vagas abertas): topo, conteúdo e rodapé. */
export default function PortalLayout() {
  const navegar = useNavigate();
  const local = useLocation();
  const { autenticado, usuario } = useAuth();
  const [aberto, { toggle, close }] = useDisclosure(false);

  // Página nova começa do topo, como num site comum.
  useEffect(() => {
    window.scrollTo(0, 0);
    close();
  }, [local.pathname, close]);

  const acoes = autenticado ? (
    <Button leftSection={<IconLayoutDashboard size={17} />}
            onClick={() => navegar(painelDe(usuario?.papel))}>
      Ir para o painel
    </Button>
  ) : (
    <>
      <Button variant="subtle" color="ink" component={Link} to="/entrar">
        Entrar
      </Button>
      <Button component={Link} to={cadastroComo("estudante")}>
        Criar conta
      </Button>
    </>
  );

  return (
    <Box className="mh-landing">
      <Box className="mh-strip">
        <Container size="xl">
          <Group h={34} justify="space-between" wrap="nowrap">
            <Text size="xs" fw={600} truncate>
              Plataforma de horas de extensão · UniC
            </Text>
            <Anchor component={Link} to="/verificar" c="inherit" underline="never"
                    size="xs" fw={600}>
              <Group gap={4} wrap="nowrap">
                <IconShieldCheck size={14} />
                Verificar certificado
              </Group>
            </Anchor>
          </Group>
        </Container>
      </Box>

      <Box component="header" className="mh-portal-header">
        <Container size="xl">
          <Group h={72} justify="space-between" wrap="nowrap">
            <BrandMark onClick={() => navegar("/")} />

            <Group gap={4} visibleFrom="lg" component="nav" aria-label="Portal">
              {LINKS_DO_PORTAL.map((link) => (
                <Button key={link.para} component={Link} to={link.para}
                        variant={ativo(local, link.para) ? "light" : "subtle"}
                        color={ativo(local, link.para) ? "brand" : "ink"}
                        size="compact-md" fw={600}>
                  {link.rotulo}
                </Button>
              ))}
            </Group>

            <Group gap="sm" wrap="nowrap">
              <Group gap="sm" visibleFrom="sm" wrap="nowrap">{acoes}</Group>
              <Burger opened={aberto} onClick={toggle} hiddenFrom="lg" size="sm"
                      aria-label={aberto ? "Fechar menu" : "Abrir menu"} />
            </Group>
          </Group>
        </Container>
      </Box>

      <Drawer opened={aberto} onClose={close} position="right" size="xs"
              title={<BrandMark compact />} hiddenFrom="lg">
        <Stack gap="xs">
          {LINKS_DO_PORTAL.map((link) => (
            <NavLink key={link.para} component={Link} to={link.para}
                     label={link.rotulo} active={ativo(local, link.para)}
                     fw={600} />
          ))}
          <NavLink component={Link} to="/verificar" label="Verificar certificado"
                   leftSection={<IconShieldCheck size={16} />} fw={600} />
          <Divider my="sm" />
          <Stack gap="sm">{acoes}</Stack>
        </Stack>
      </Drawer>

      <Box component="main">
        <Outlet />
      </Box>

      <Box component="footer" className="mh-footer">
        <Container size="xl" py="xl">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
            <Stack gap="xs" maw={320}>
              <Group gap={10}>
                <BrandIcon size={36} style={{ borderRadius: 10 }} />
                <Text fw={900} fz="lg" c="white">
                  Mais<Text span inherit c="brand.3">Horas</Text>
                </Text>
              </Group>
              <Text size="sm" c="rgba(255,255,255,0.7)">
                Conectando estudantes e ONGs por horas que transformam. Projeto
                Integrador — UniC.
              </Text>
            </Stack>

            <Group gap={56} align="flex-start" wrap="wrap">
              <Stack gap={6}>
                <Text fw={700} c="white" size="sm">Conheça</Text>
                {LINKS_DO_PORTAL.map((link) => (
                  <Anchor key={link.para} component={Link} to={link.para}
                          c="rgba(255,255,255,0.75)" size="sm">
                    {link.rotulo}
                  </Anchor>
                ))}
              </Stack>
              <Stack gap={6}>
                <Text fw={700} c="white" size="sm">Plataforma</Text>
                <Anchor component={Link} to="/entrar" c="rgba(255,255,255,0.75)" size="sm">
                  Entrar
                </Anchor>
                <Anchor component={Link} to={cadastroComo("estudante")}
                        c="rgba(255,255,255,0.75)" size="sm">
                  Criar conta
                </Anchor>
                <Anchor component={Link} to="/verificar" c="rgba(255,255,255,0.75)" size="sm">
                  Verificar certificado
                </Anchor>
              </Stack>
              <Stack gap={6}>
                <Text fw={700} c="white" size="sm">Equipe</Text>
                {["Pedro Batista", "Ismael Brandão", "Antônio Yarlen"].map((nome) => (
                  <Text key={nome} c="rgba(255,255,255,0.75)" size="sm">{nome}</Text>
                ))}
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
