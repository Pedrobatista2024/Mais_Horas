import {
  AppShell, Avatar, Box, Burger, Group, Menu, ScrollArea, Stack, Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconBuildingCommunity, IconCalendarEvent, IconCertificate, IconChevronDown,
  IconLayoutDashboard, IconListSearch, IconLogout, IconPlus, IconSearch,
  IconServerCog, IconTicket, IconUser, IconUsers,
} from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { initials } from "../../utils/format";
import TarjaEspelho from "../admin/TarjaEspelho";
import Sino from "../notificacao/Sino";
import BrandMark from "../ui/BrandMark";

/**
 * O menu só lista telas que existem.
 *
 * Item que leva a "em construção" é pior que item ausente: promete algo e
 * frustra.
 */
const MENU_ESTUDANTE = [
  { rotulo: "Painel", para: "/painel", icone: IconLayoutDashboard, exato: true },
  { rotulo: "Buscar atividades", para: "/atividades", icone: IconSearch },
  { rotulo: "Minhas inscrições", para: "/minhas-inscricoes", icone: IconTicket },
  { rotulo: "Certificados", para: "/meus-certificados", icone: IconCertificate },
];

const MENU_ONG = [
  { rotulo: "Painel", para: "/ong", icone: IconLayoutDashboard, exato: true },
  { rotulo: "Minhas atividades", para: "/ong/atividades", icone: IconCalendarEvent,
    exato: true, tambem: /^\/ong\/atividades\/(?!nova)[^/]+/ },
  { rotulo: "Nova atividade", para: "/ong/atividades/nova", icone: IconPlus },
];

const MENU_ADMIN = [
  { rotulo: "Visão geral", para: "/admin", icone: IconLayoutDashboard, exato: true },
  { rotulo: "Auditoria", para: "/admin/auditoria", icone: IconListSearch },
  { rotulo: "Usuários", para: "/admin/usuarios", icone: IconUsers },
  { rotulo: "Organizações", para: "/admin/ongs", icone: IconBuildingCommunity },
  { rotulo: "Atividades", para: "/admin/atividades", icone: IconCalendarEvent },
  { rotulo: "Certificados", para: "/admin/certificados", icone: IconCertificate },
  { rotulo: "Sistema", para: "/admin/sistema", icone: IconServerCog },
];

const MENU_POR_PAPEL = {
  estudante: MENU_ESTUDANTE,
  ong: MENU_ONG,
  superadmin: MENU_ADMIN,
};

const ROTULO_PAPEL = {
  estudante: "Estudante",
  ong: "Organização",
  superadmin: "Administração",
};

/**
 * Casca da área logada: menu lateral azul-noite, topo branco e o trilho de
 * conteúdo sobre fundo azul-claro.
 *
 * No computador o menu ocupa a altura toda e leva o logotipo (`layout="alt"`
 * do AppShell); o topo fica só sobre o conteúdo, com avisos e conta. No
 * celular o topo mostra o logotipo e o botão que abre o menu.
 */
export default function PainelLayout() {
  const { usuario, sair, espelho, sairDoModo } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [aberto, { toggle, close }] = useDisclosure(false);

  const papel = usuario?.papel;
  const menu = MENU_POR_PAPEL[papel] || MENU_ESTUDANTE;
  const eOng = papel === "ong";

  async function encerrar() {
    // No espelho, "Sair" encerra o modo — não a sessão do admin.
    if (espelho) {
      await sairDoModo({ voltarPara: `/admin/usuarios/${espelho.alvo.id}` });
      return;
    }
    await sair();
    navegar("/entrar");
  }

  function estaAtivo(item) {
    if (item.tambem?.test(local.pathname)) return true;
    if (item.exato) return local.pathname === item.para;
    return local.pathname === item.para || local.pathname.startsWith(`${item.para}/`);
  }

  return (
    <AppShell
      layout="alt"
      header={{ height: espelho ? 104 : 64 }}
      navbar={{ width: 256, breakpoint: "md", collapsed: { mobile: !aberto } }}
      padding={0}
      className="mh-app"
    >
      <a href="#conteudo" className="mh-pular">Pular para o conteúdo</a>

      <AppShell.Header className="mh-topbar">
        {espelho && <TarjaEspelho />}
        <Group h={64} px={{ base: "md", md: "xl" }} justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={aberto} onClick={toggle} hiddenFrom="md" size="sm"
                    aria-label={aberto ? "Fechar menu" : "Abrir menu"} />
            <Box hiddenFrom="md">
              <BrandMark compact onClick={() => navegar(painelDe(papel))} />
            </Box>
          </Group>

          <Group gap={4} wrap="nowrap">
            <Sino />
            <Menu width={220} position="bottom-end" shadow="sm">
              <Menu.Target>
                <UnstyledButton aria-label="Abrir menu da conta" px={6} py={4}
                                style={{ borderRadius: 6 }}>
                  <Group gap={8} wrap="nowrap">
                    <Avatar color={eOng ? "navy" : "brand"} radius="xl" size={32}>
                      {eOng ? <IconBuildingCommunity size={17} /> : initials(usuario?.nome)}
                    </Avatar>
                    <IconChevronDown size={14} color="var(--mh-tinta-3)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{ROTULO_PAPEL[papel] || ""}</Menu.Label>
                <Menu.Item leftSection={<IconUser size={16} />} component={Link}
                           to="/perfil" onClick={close}>
                  {espelho ? "Perfil" : "Meu perfil"}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={encerrar}>
                  {espelho ? "Sair do modo" : "Sair"}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {aberto && <Box className="mh-veu-menu" hiddenFrom="md" onClick={close} aria-hidden="true" />}

      <AppShell.Navbar className="mh-sidebar" data-aberto={aberto || undefined}>
        <Stack h="100%" gap={0} p="md" pt={0}>
          <Group h={64} px={8} mb="sm" justify="space-between" wrap="nowrap">
            <BrandMark compact claro onClick={() => navegar(painelDe(papel))} />
            <Burger opened={aberto} onClick={toggle} hiddenFrom="md" size="sm" color="white"
                    aria-label="Fechar menu" />
          </Group>
          <ScrollArea flex={1} type="auto">
            <Stack gap={2} component="nav" aria-label="Menu principal">
              {menu.map((item) => {
                const ativo = estaAtivo(item);
                return (
                  <UnstyledButton key={item.para} component={Link} to={item.para}
                                  className="mh-nav-button" onClick={close}
                                  data-active={ativo || undefined}
                                  aria-current={ativo ? "page" : undefined}>
                    <item.icone size={19} stroke={1.75} aria-hidden="true" />
                    {item.rotulo}
                  </UnstyledButton>
                );
              })}
            </Stack>
          </ScrollArea>

          <Box pt="md" mt="sm" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.12)" }}>
            <Group gap="sm" px={8} mb="sm" wrap="nowrap">
              <Avatar color="brand.5" radius="xl" size={34} variant="filled">
                {eOng ? <IconBuildingCommunity size={17} /> : initials(usuario?.nome)}
              </Avatar>
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} c="white" truncate>{usuario?.nome}</Text>
                <Text size="xs" c="rgba(255,255,255,0.6)">{ROTULO_PAPEL[papel] || ""}</Text>
              </Box>
            </Group>
            <UnstyledButton className="mh-nav-button" onClick={encerrar}>
              <IconLogout size={19} stroke={1.75} aria-hidden="true" />
              {espelho ? "Sair do modo" : "Sair"}
            </UnstyledButton>
          </Box>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <div id="conteudo" className="mh-pagina" tabIndex={-1}>
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
