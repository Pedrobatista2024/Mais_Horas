import { AppShell, Group, Button, Text, Menu, Avatar, Burger, Stack, Container } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconSearch,
  IconCertificate,
  IconCalendarEvent,
  IconUser,
  IconLogout,
  IconPlus,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../utils/format";

const STUDENT_NAV = [
  { label: "Painel", to: "/dashboard", icon: IconLayoutDashboard },
  { label: "Buscar atividades", to: "/activities", icon: IconSearch },
  { label: "Minhas inscrições", to: "/my-activities", icon: IconCalendarEvent },
  { label: "Certificados", to: "/my-certificates", icon: IconCertificate },
];

const ORG_NAV = [
  { label: "Painel", to: "/org", icon: IconLayoutDashboard },
  { label: "Minhas atividades", to: "/org/my-activities", icon: IconCalendarEvent },
  { label: "Nova atividade", to: "/org/create-activity", icon: IconPlus },
];

function Logo({ onClick }) {
  return (
    <Text fw={900} fz="xl" style={{ cursor: "pointer" }} onClick={onClick}>
      Mais
      <Text span c="brand.6" inherit>
        Horas
      </Text>
    </Text>
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

  function go(to) {
    navigate(to);
    close();
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const NavButtons = ({ vertical }) =>
    nav.map((item) => {
      const active =
        location.pathname === item.to ||
        (item.to !== home && location.pathname.startsWith(item.to));
      return (
        <Button
          key={item.to}
          variant={active ? "light" : "subtle"}
          color={active ? "brand" : "gray"}
          leftSection={<item.icon size={18} />}
          onClick={() => go(item.to)}
          fullWidth={vertical}
          justify={vertical ? "flex-start" : undefined}
        >
          {item.label}
        </Button>
      );
    });

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { desktop: true, mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Logo onClick={() => go(home)} />
          </Group>

          <Group gap="xs" visibleFrom="sm">
            <NavButtons />
          </Group>

          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <Group gap="xs" style={{ cursor: "pointer" }}>
                <Avatar color={isOrg ? "navy" : "brand"} radius="xl" size={36}>
                  {isOrg ? <IconBuildingCommunity size={18} /> : initials(user?.name)}
                </Avatar>
                <Text size="sm" fw={600} visibleFrom="md">
                  {user?.name}
                </Text>
              </Group>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{isOrg ? "Organização" : "Estudante"}</Menu.Label>
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

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <NavButtons vertical />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
