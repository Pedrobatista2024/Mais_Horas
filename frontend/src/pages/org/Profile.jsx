import { useNavigate } from "react-router-dom";
import { Avatar, Button, Divider, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconBrandInstagram,
  IconBuildingCommunity,
  IconEdit,
  IconId,
  IconMail,
  IconMapPin,
  IconPhone,
  IconWorld,
} from "@tabler/icons-react";

import InfoItem from "../../components/ui/InfoItem";
import Loading from "../../components/ui/Loading";
import { useFetch } from "../../hooks/useFetch";
import { resolveImage } from "../../utils/format";

export default function OrgProfile() {
  const navigate = useNavigate();
  const { data, loading } = useFetch("/users/profile");

  if (loading) return <Loading />;

  const user = data?.user || {};
  const op = user.organizationProfile || {};
  const logo = resolveImage(op.photo);
  const websiteHref = op.website
    ? op.website.startsWith("http")
      ? op.website
      : `https://${op.website}`
    : null;

  return (
    <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} className="mh-page-band">
      <Group justify="space-between" align="flex-start" wrap="wrap" mb="lg">
        <Group wrap="wrap">
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
          <Text size="sm" c="dimmed" fw={700} tt="uppercase">
            Sobre a organização
          </Text>
          <Text mb="lg" style={{ whiteSpace: "pre-wrap" }}>
            {op.description}
          </Text>
        </>
      )}

      <Divider my="md" />
      <Stack gap="md">
        <Text fw={800}>Contato</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <InfoItem icon={IconMail} label="Email" value={user.email} color="navy" />
          <InfoItem icon={IconPhone} label="Telefone" value={op.phone} color="navy" />
          <InfoItem icon={IconMapPin} label="Endereço" value={op.address} color="navy" />
          <InfoItem icon={IconId} label="CNPJ" value={op.cnpj} color="navy" />
          <InfoItem icon={IconWorld} label="Website" value={op.website} href={websiteHref} color="navy" />
          <InfoItem icon={IconBrandInstagram} label="Instagram" value={op.instagram} color="navy" />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
