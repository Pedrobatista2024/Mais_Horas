import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconBuildingCommunity,
  IconCalendarEvent,
  IconCertificate,
  IconChevronRight,
  IconLayoutDashboard,
  IconLogout,
  IconPlus,
  IconSearch,
  IconUser,
} from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import { initials } from "../../utils/format";
import BrandMark from "../ui/BrandMark";

const STUDENT_NAV = [
  { label: "Painel", to: "/dashboard", icon: IconLayoutDashboard, end: true },
  {
    label: "Buscar atividades",
    to: "/activities",
    icon: IconSearch,
    match: (path) => path === "/activities" || path.startsWith("/student/activity/"),
  },
  { label: "Minhas inscrições", to: "/my-activities", icon: IconCalendarEvent },
  { label: "Certificados", to: "/my-certificates", icon: IconCertificate },
];

const ORG_NAV = [
  { label: "Painel", to: "/org", icon: IconLayoutDashboard, end: true },
  {
    label: "Minhas atividades",
    to: "/org/my-activities",
    icon: IconCalendarEvent,
    match: (path) => path === "/org/my-activities" || path.startsWith("/org/activity/"),
  },
  { label: "Nova atividade", to: "/org/create-activity", icon: IconPlus },
];

function NavItem({ item, active, onClick }) {
  return (
    <UnstyledButton className="mh-nav-button" data-active={active || undefined} onClick={onClick}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon
          variant={active ? "light" : "transparent"}
          color={active ? "brand" : "gray"}
          size={34}
          radius="md"
        >
          <item.icon size={20} />
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" truncate>
            {item.label}
          </Text>
        </Box>
        <IconChevronRight size={16} opacity={active ? 0.65 : 0.28} />
      </Group>
    </UnstyledButton>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { toggle, close }] = useDisclosure(false);

  const isOrg = user?.role === "organization";
  const nav = isOrg ? ORG_NAV : STUDENT_NAV;
  const home = isOrg ? "/org" : "/dashboard";
  const roleLabel = isOrg ? "Organização" : "Estudante";
  const avatarContent = isOrg ? <IconBuildingCommunity size={19} /> : initials(user?.name);

  function go(to) {
    navigate(to);
    close();
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function isActive(item) {
    if (item.match) return item.match(location.pathname);
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  }

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 292, breakpoint: "md", collapsed: { mobile: !opened } }}
      padding={0}
      className="mh-app-shell"
    >
      <AppShell.Header className="mh-topbar">
        <Group h="100%" px={{ base: "md", md: "xl" }} justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
              aria-label={opened ? "Fechar menu lateral" : "Abrir menu lateral"}
            />
            <BrandMark compact onClick={() => go(home)} />
          </Group>

          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <UnstyledButton aria-label="Abrir menu do usuário">
                <Group gap="xs" wrap="nowrap">
                  <Box visibleFrom="sm" style={{ textAlign: "right" }}>
                    <Text size="sm" fw={700} lh={1.2}>
                      {user?.name}
                    </Text>
                    <Text size="xs" c="dimmed" lh={1.2}>
                      {roleLabel}
                    </Text>
                  </Box>
                  <Avatar color={isOrg ? "navy" : "brand"} radius="xl" size={38}>
                    {avatarContent}
                  </Avatar>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{roleLabel}</Menu.Label>
              <Menu.Item
                leftSection={<IconUser size={16} />}
                onClick={() => go(isOrg ? "/org/profile" : "/edit-student-profile")}
              >
                Meu perfil
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={handleLogout}>
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
              {nav.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  active={isActive(item)}
                  onClick={() => go(item.to)}
                />
              ))}
            </Stack>
          </ScrollArea>

          <Divider />

          <Button
            variant="subtle"
            color="red"
            fullWidth
            justify="flex-start"
            leftSection={<IconLogout size={18} />}
            onClick={handleLogout}
          >
            Sair
          </Button>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="mh-main">
        <Container size="xl" px={{ base: "md", sm: "lg", xl: 0 }} py={{ base: "lg", md: 32 }}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
