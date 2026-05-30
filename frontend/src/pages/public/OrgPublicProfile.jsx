import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Paper,
  Group,
  Avatar,
  Title,
  Text,
  Button,
  Stack,
  Divider,
  SimpleGrid,
  Anchor,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBuildingCommunity,
  IconPhone,
  IconMail,
  IconWorld,
  IconBrandInstagram,
  IconMapPin,
} from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { notifyError } from "../../utils/notify";
import { resolveImage } from "../../utils/format";

function Contact({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Icon size={18} style={{ opacity: 0.6, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={600}>
          {value}
        </Text>
      </div>
    </Group>
  );
}

export default function OrgPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/users/org/${id}/public`);
        setUser(data.user);
      } catch (err) {
        notifyError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <PublicPage maxWidth="md">
      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={18} />}
        onClick={() => navigate(-1)}
        mb="md"
      >
        Voltar
      </Button>

      {loading ? (
        <Loading />
      ) : !user ? (
        <Text>ONG não encontrada.</Text>
      ) : (
        <Paper withBorder radius="lg" p="xl" shadow="sm">
          <Group wrap="nowrap" mb="lg">
            <Avatar src={resolveImage(user.organizationProfile?.photo)} size={84} radius="md" color="navy">
              <IconBuildingCommunity size={40} />
            </Avatar>
            <div>
              <Title order={2}>{user.organizationProfile?.organizationName || user.name}</Title>
              <Text c="dimmed">Organização</Text>
            </div>
          </Group>

          {user.organizationProfile?.description && (
            <Text mb="lg" style={{ whiteSpace: "pre-wrap" }}>
              {user.organizationProfile.description}
            </Text>
          )}

          <Divider my="md" />
          <Stack gap="md">
            <Text fw={700}>Contato</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Contact icon={IconMail} label="Email" value={user.email} />
              <Contact icon={IconPhone} label="Telefone" value={user.organizationProfile?.phone} />
              <Contact icon={IconMapPin} label="Endereço" value={user.organizationProfile?.address} />
              <Contact icon={IconWorld} label="Website" value={user.organizationProfile?.website} />
              <Contact
                icon={IconBrandInstagram}
                label="Instagram"
                value={user.organizationProfile?.instagram}
              />
            </SimpleGrid>
          </Stack>
        </Paper>
      )}
    </PublicPage>
  );
}
