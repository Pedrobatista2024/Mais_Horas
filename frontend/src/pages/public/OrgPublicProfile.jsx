import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Divider, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconBrandInstagram,
  IconBuildingCommunity,
  IconMail,
  IconMapPin,
  IconPhone,
  IconWorld,
} from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import BackButton from "../../components/ui/BackButton";
import InfoItem from "../../components/ui/InfoItem";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { notifyError } from "../../utils/notify";
import { resolveImage } from "../../utils/format";

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

  const profile = user?.organizationProfile || {};

  return (
    <PublicPage maxWidth="md">
      <BackButton onClick={() => navigate(-1)} />

      {loading ? (
        <Loading />
      ) : !user ? (
        <Text>ONG não encontrada.</Text>
      ) : (
        <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} shadow="sm" className="mh-page-band">
          <Group wrap="wrap" mb="lg">
            <Avatar src={resolveImage(profile.photo)} size={84} radius="md" color="navy">
              <IconBuildingCommunity size={40} />
            </Avatar>
            <div>
              <Title order={2}>{profile.organizationName || user.name}</Title>
              <Text c="dimmed">Organização</Text>
            </div>
          </Group>

          {profile.description && (
            <Text mb="lg" style={{ whiteSpace: "pre-wrap" }}>
              {profile.description}
            </Text>
          )}

          <Divider my="md" />
          <Stack gap="md">
            <Text fw={800}>Contato</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <InfoItem icon={IconMail} label="Email" value={user.email} color="navy" />
              <InfoItem icon={IconPhone} label="Telefone" value={profile.phone} color="navy" />
              <InfoItem icon={IconMapPin} label="Endereço" value={profile.address} color="navy" />
              <InfoItem icon={IconWorld} label="Website" value={profile.website} color="navy" />
              <InfoItem icon={IconBrandInstagram} label="Instagram" value={profile.instagram} color="navy" />
            </SimpleGrid>
          </Stack>
        </Paper>
      )}
    </PublicPage>
  );
}
