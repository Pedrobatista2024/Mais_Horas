import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Anchor, Box, Burger, Button, Container, Divider, Drawer, Group, NavLink, SimpleGrid,
  Stack, Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { cadastroComo, LARGURA_DO_PORTAL, LINKS_DO_PORTAL } from "../portal/navegacao";
import BrandMark from "../ui/BrandMark";


function ativo(local, para) {
  return local.pathname === para || local.pathname.startsWith(`${para}/`);
}

/**
 * Casca do portal público: topo, conteúdo e rodapé.
 *
 * O topo tem os links em texto, "Verificar certificado" à vista (é o que a
 * coordenação vem fazer aqui) e uma ação só: criar conta. A faixa azul que
 * ficava acima do topo repetia o link de verificação e saiu.
 */
export default function PortalLayout() {
  const local = useLocation();
  const { autenticado, usuario } = useAuth();
  const [aberto, { toggle, close }] = useDisclosure(false);

  // Página nova começa do topo, como num site comum.
  useEffect(() => {
    window.scrollTo(0, 0);
    close();
  }, [local.pathname, close]);

  const acoes = autenticado ? (
    <Button component={Link} to={painelDe(usuario?.papel)}>Ir para o painel</Button>
  ) : (
    <>
      <Button variant="subtle" color="gray" component={Link} to="/entrar">Entrar</Button>
      <Button component={Link} to={cadastroComo("estudante")}>Criar conta</Button>
    </>
  );

  return (
    <Box bg="white">
      <a href="#conteudo" className="mh-pular">Pular para o conteúdo</a>

      <Box component="header" className="mh-portal-header">
        <Container size={LARGURA_DO_PORTAL}>
          <Group h={64} justify="space-between" wrap="nowrap" gap="md">
            <Group gap={32} wrap="nowrap">
              <Link to="/" aria-label="Mais Horas, página inicial"
                    style={{ textDecoration: "none" }}>
                <BrandMark compact />
              </Link>
              <Group gap={2} visibleFrom="lg" component="nav" aria-label="Portal">
                {LINKS_DO_PORTAL.map((link) => (
                  <Link key={link.para} to={link.para} className="mh-portal-link"
                        data-active={ativo(local, link.para) || undefined}
                        aria-current={ativo(local, link.para) ? "page" : undefined}>
                    {link.rotulo}
                  </Link>
                ))}
              </Group>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Link to="/verificar" className="mh-portal-link mh-so-largo"
                    data-active={ativo(local, "/verificar") || undefined}>
                Verificar certificado
              </Link>
              <Group gap="xs" visibleFrom="sm" wrap="nowrap">{acoes}</Group>
              <Burger opened={aberto} onClick={toggle} hiddenFrom="lg" size="sm"
                      aria-label={aberto ? "Fechar menu" : "Abrir menu"} />
            </Group>
          </Group>
        </Container>
      </Box>

      <Drawer opened={aberto} onClose={close} position="right" size="xs"
              title={<BrandMark compact />} hiddenFrom="lg">
        <Stack gap={2} component="nav" aria-label="Portal">
          {[...LINKS_DO_PORTAL, { para: "/verificar", rotulo: "Verificar certificado" }]
            .map((link) => (
              <NavLink key={link.para} component={Link} to={link.para}
                       label={link.rotulo} active={ativo(local, link.para)}
                       style={{ borderRadius: 6 }} />
            ))}
          <Divider my="sm" />
          <Stack gap="sm">{acoes}</Stack>
        </Stack>
      </Drawer>

      <Box component="main" id="conteudo" tabIndex={-1} style={{ outline: "none" }}>
        <Outlet />
      </Box>

      <Box component="footer" className="mh-footer">
        <Container size={LARGURA_DO_PORTAL} py={48}>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
            <Stack gap="xs">
              <Text fw={700} fz="lg" c="white">Mais Horas</Text>
              <Text size="sm">
                Vagas de voluntariado para horas de extensão, com certificado que se
                confere pelo QR Code.
              </Text>
            </Stack>
            <Stack gap={8}>
              <Text fw={600} c="white" size="sm">O portal</Text>
              {LINKS_DO_PORTAL.map((link) => (
                <Anchor key={link.para} component={Link} to={link.para} size="sm">
                  {link.rotulo}
                </Anchor>
              ))}
            </Stack>
            <Stack gap={8}>
              <Text fw={600} c="white" size="sm">Sua conta</Text>
              <Anchor component={Link} to="/entrar" size="sm">Entrar</Anchor>
              <Anchor component={Link} to={cadastroComo("estudante")} size="sm">
                Criar conta de estudante
              </Anchor>
              <Anchor component={Link} to={cadastroComo("ong")} size="sm">
                Cadastrar uma ONG
              </Anchor>
              <Anchor component={Link} to="/verificar" size="sm">Verificar certificado</Anchor>
            </Stack>
            <Stack gap={8}>
              <Text fw={600} c="white" size="sm">Quem fez</Text>
              {["Pedro Batista", "Ismael Brandão", "Antônio Yarlen"].map((nome) => (
                <Text key={nome} size="sm">{nome}</Text>
              ))}
            </Stack>
          </SimpleGrid>
          <Divider my="xl" color="rgba(255,255,255,0.14)" />
          <Text size="sm">
            Projeto Integrador do curso de Sistemas de Informação, Centro Universitário
            Cearense (UniC), {new Date().getFullYear()}.
          </Text>
        </Container>
      </Box>
    </Box>
  );
}
