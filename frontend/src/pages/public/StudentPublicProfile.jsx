import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Divider, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconBook, IconBrandLinkedin, IconMail, IconMapPin, IconSchool } from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import BackButton from "../../components/ui/BackButton";
import InfoItem from "../../components/ui/InfoItem";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { notifyError } from "../../utils/notify";
import { initials, resolveImage } from "../../utils/format";

export default function StudentPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/users/student/${id}/public`);
        setUser(data.user);
      } catch (err) {
        notifyError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const sp = user?.studentProfile || {};
  const location = [sp.neighborhood, sp.city, sp.state].filter(Boolean).join(", ");

  return (
    <PublicPage maxWidth="md">
      <BackButton onClick={() => navigate(-1)} />

      {loading ? (
        <Loading />
      ) : !user ? (
        <Text>Aluno não encontrado.</Text>
      ) : (
        <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} shadow="sm" className="mh-page-band">
          <Group wrap="wrap" mb="lg">
            <Avatar src={resolveImage(sp.photo, sp.photoUrl)} size={84} radius="xl" color="brand">
              {initials(user.name)}
            </Avatar>
            <div>
              <Title order={2}>{user.name}</Title>
              <Text c="dimmed">Estudante</Text>
            </div>
          </Group>

          {sp.aboutMe && (
            <Text mb="lg" style={{ whiteSpace: "pre-wrap" }}>
              {sp.aboutMe}
            </Text>
          )}

          <Divider my="md" />
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <InfoItem icon={IconMail} label="Email" value={user.email} />
              <InfoItem icon={IconMapPin} label="Localização" value={location} />
              <InfoItem icon={IconSchool} label="Instituição" value={sp.institution} />
              <InfoItem icon={IconBook} label="Curso" value={sp.courseName} />
              <InfoItem icon={IconBrandLinkedin} label="LinkedIn" value={sp.linkedin} />
            </SimpleGrid>
          </Stack>
        </Paper>
      )}
    </PublicPage>
  );
}
