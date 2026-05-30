import { useNavigate } from "react-router-dom";
import { Paper, Group, Avatar, Title, Text, Button, Stack, Divider, SimpleGrid, Anchor } from "@mantine/core";
import {
  IconEdit,
  IconBuildingCommunity,
  IconPhone,
  IconMail,
  IconWorld,
  IconBrandInstagram,
  IconMapPin,
  IconId,
} from "@tabler/icons-react";

import Loading from "../../components/ui/Loading";
import { useFetch } from "../../hooks/useFetch";
import { resolveImage } from "../../utils/format";

function Contact({ icon: Icon, label, value, href }) {
  if (!value) return null;
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Icon size={18} style={{ opacity: 0.6, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        {href ? (
          <Anchor href={href} target="_blank" size="sm" fw={600}>
            {value}
          </Anchor>
        ) : (
          <Text size="sm" fw={600}>
            {value}
          </Text>
        )}
      </div>
    </Group>
  );
}

export default function OrgProfile() {
  const navigate = useNavigate();
  const { data, loading } = useFetch("/users/profile");

  if (loading) return <Loading />;

  const user = data?.user || {};
  const op = user.organizationProfile || {};
  const logo = resolveImage(op.photo);

  return (
    <Paper withBorder radius="md" p="xl">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="lg">
        <Group wrap="nowrap">
          <Avatar src={logo} size={84} radius="md" color="navy">
            <IconBuildingCommunity size={40} />
          </Avatar>
          <div>
            <Title order={2}>{op.organizationName || user.name}</Title>
            <Text c="dimmed">{user.email}</Text>
          </div>
        </Group>
        <Button leftSection={<IconEdit size={18} />} onClick={() => navigate("/org/profile/edit")}>
          Editar
        </Button>
      </Group>

      {op.description && (
        <>
          <Text size="sm" c="dimmed">
            Sobre a organização
          </Text>
          <Text mb="lg" style={{ whiteSpace: "pre-wrap" }}>
            {op.description}
          </Text>
        </>
      )}

      <Divider my="md" />
      <Stack gap="md">
        <Text fw={700}>Contato</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Contact icon={IconMail} label="Email" value={user.email} />
          <Contact icon={IconPhone} label="Telefone" value={op.phone} />
          <Contact icon={IconMapPin} label="Endereço" value={op.address} />
          <Contact icon={IconId} label="CNPJ" value={op.cnpj} />
          <Contact
            icon={IconWorld}
            label="Website"
            value={op.website}
            href={op.website ? (op.website.startsWith("http") ? op.website : `https://${op.website}`) : null}
          />
          <Contact icon={IconBrandInstagram} label="Instagram" value={op.instagram} />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
