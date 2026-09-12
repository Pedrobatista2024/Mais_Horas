import {
  AppShell, Avatar, Box, Burger, Button, Container, Divider, Group, Menu,
  ScrollArea, Stack, Text, ThemeIcon, UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconBuildingCommunity, IconCalendarEvent, IconChevronRight,
  IconLayoutDashboard, IconLogout, IconPlus, IconSearch, IconUser,
} from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { initials } from "../../utils/format";
import BrandMark from "../ui/BrandMark";

/**
 * O menu só lista telas que existem.
 *
 * Item que leva a "em construção" é pior que item ausente: promete algo e
 * frustra. As demais entram com as fatias seguintes.
 */
const MENU_ESTUDANTE = [
  { rotulo: "Painel", para: "/painel", icone: IconLayoutDashboard, exato: true },
  { rotulo: "Buscar atividades", para: "/atividades", icone: IconSearch },
];

const MENU_ONG = [
  { rotulo: "Painel", para: "/ong", icone: IconLayoutDashboard, exato: true },
  { rotulo: "Minhas atividades", para: "/ong/atividades", icone: IconCalendarEvent,
    exato: true },
  { rotulo: "Nova atividade", para: "/ong/atividades/nova", icone: IconPlus },
];

const MENU_ADMIN = [
  { rotulo: "Painel", para: "/admin", icone: IconLayoutDashboard, exato: true },
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

function ItemDeMenu({ item, ativo, aoClicar }) {
  return (
    <UnstyledButton className="mh-nav-button" data-active={ativo || undefined}
                    onClick={aoClicar}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant={ativo ? "light" : "transparent"} color={ativo ? "brand" : "gray"}
                   size={34} radius="md">
          <item.icone size={20} />
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" truncate>
            {item.rotulo}
          </Text>
        </Box>
        <IconChevronRight size={16} opacity={ativo ? 0.65 : 0.28} />
      </Group>
    </UnstyledButton>
  );
}

/** Casca da área logada: topo, menu lateral e o conteúdo da rota. */
export default function PainelLayout() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [aberto, { toggle, close }] = useDisclosure(false);

  const papel = usuario?.papel;
  const menu = MENU_POR_PAPEL[papel] || MENU_ESTUDANTE;
  const eOng = papel === "ong";

  function ir(para) {
    navegar(para);
    close();
  }

  async function encerrar() {
    await sair();
    navegar("/entrar");
  }

  function estaAtivo(item) {
    if (item.exato) return local.pathname === item.para;
    return local.pathname === item.para || local.pathname.startsWith(`${item.para}/`);
  }

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 292, breakpoint: "md", collapsed: { mobile: !aberto } }}
      padding={0}
      className="mh-app-shell"
    >
      <AppShell.Header className="mh-topbar">
        <Group h="100%" px={{ base: "md", md: "xl" }} justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={aberto}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
              aria-label={aberto ? "Fechar menu lateral" : "Abrir menu lateral"}
            />
            <BrandMark compact onClick={() => ir(painelDe(papel))} />
          </Group>

          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <UnstyledButton aria-label="Abrir menu do usuário">
                <Group gap="xs" wrap="nowrap">
                  <Box visibleFrom="sm" style={{ textAlign: "right" }}>
                    <Text size="sm" fw={700} lh={1.2}>
                      {usuario?.nome}
                    </Text>
                    <Text size="xs" c="dimmed" lh={1.2}>
                      {ROTULO_PAPEL[papel] || ""}
                    </Text>
                  </Box>
                  <Avatar color={eOng ? "navy" : "brand"} radius="xl" size={38}>
                    {eOng ? <IconBuildingCommunity size={19} /> : initials(usuario?.nome)}
                  </Avatar>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{ROTULO_PAPEL[papel] || ""}</Menu.Label>
              <Menu.Item leftSection={<IconUser size={16} />} onClick={() => ir("/perfil")}>
                Meu perfil
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconLogout size={16} />}
                         onClick={encerrar}>
                Sair
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="mh-sidebar">
        <Stack h="100%" gap="sm" p="md">
          <Text size="xs" fw={800} tt="uppercase" c="dimmed" px={8} pt={4}>
            Menu
          </Text>
          <ScrollArea flex={1} type="auto" offsetScrollbars>
            <Stack gap={6}>
              {menu.map((item) => (
                <ItemDeMenu key={item.para} item={item} ativo={estaAtivo(item)}
                            aoClicar={() => ir(item.para)} />
              ))}
            </Stack>
          </ScrollArea>

          <Divider />

          <Button variant="subtle" color="red" fullWidth justify="flex-start"
                  leftSection={<IconLogout size={18} />} onClick={encerrar}>
            Sair
          </Button>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="mh-main">
        <Container size="xl" px={{ base: "md", sm: "lg", xl: 0 }}
                   py={{ base: "lg", md: 32 }}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
