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
} from "@mantine/core";
import {
  IconArrowLeft,
  IconMail,
  IconMapPin,
  IconSchool,
  IconBook,
  IconBrandLinkedin,
} from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { notifyError } from "../../utils/notify";
import { resolveImage, initials } from "../../utils/format";

function Info({ icon: Icon, label, value }) {
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
        <Text>Aluno não encontrado.</Text>
      ) : (
        <Paper withBorder radius="lg" p="xl" shadow="sm">
          <Group wrap="nowrap" mb="lg">
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
              <Info icon={IconMail} label="Email" value={user.email} />
              <Info icon={IconMapPin} label="Localização" value={location} />
              <Info icon={IconSchool} label="Instituição" value={sp.institution} />
              <Info icon={IconBook} label="Curso" value={sp.courseName} />
              <Info icon={IconBrandLinkedin} label="LinkedIn" value={sp.linkedin} />
            </SimpleGrid>
          </Stack>
        </Paper>
      )}
    </PublicPage>
  );
}
