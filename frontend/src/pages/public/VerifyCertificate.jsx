import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Paper, Stack, Text, Group, ThemeIcon, Title, Badge, Divider, Loader, Center } from "@mantine/core";
import { IconShieldCheck, IconShieldX, IconCalendar, IconBuildingCommunity, IconUser, IconHourglass } from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import { api } from "../../services/api";
import { formatDate } from "../../utils/format";

function Row({ icon: Icon, label, value }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Icon size={18} style={{ opacity: 0.6, marginTop: 2 }} />
      <div>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text fw={600}>{value}</Text>
      </div>
    </Group>
  );
}

export default function VerifyCertificate() {
  const { code } = useParams();
  const [state, setState] = useState({ loading: true, valid: false, cert: null });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/certificates/validate/${code}`);
        setState({ loading: false, valid: data.valid, cert: data.certificate });
      } catch {
        setState({ loading: false, valid: false, cert: null });
      }
    })();
  }, [code]);

  return (
    <PublicPage>
      <Paper withBorder radius="lg" p="xl" shadow="sm">
        {state.loading ? (
          <Center py="xl">
            <Loader color="brand" />
          </Center>
        ) : state.valid ? (
          <Stack>
            <Group>
              <ThemeIcon color="brand" size={56} radius="xl">
                <IconShieldCheck size={32} />
              </ThemeIcon>
              <div>
                <Title order={3}>Certificado válido</Title>
                <Text c="dimmed" size="sm">
                  Este certificado foi emitido pela plataforma Mais Horas.
                </Text>
              </div>
            </Group>

            <Divider />

            <Row icon={IconUser} label="Estudante" value={state.cert.user?.name} />
            <Row icon={IconBuildingCommunity} label="Atividade" value={state.cert.activity?.title} />
            <Row
              icon={IconBuildingCommunity}
              label="Organização"
              value={state.cert.activity?.createdBy?.name || "—"}
            />
            <Group>
              <Row icon={IconHourglass} label="Carga horária" value={`${state.cert.hours}h`} />
              <Row
                icon={IconCalendar}
                label="Data da atividade"
                value={formatDate(state.cert.activity?.date)}
              />
            </Group>

            <Badge variant="light" color="gray" radius="sm" mt="xs">
              Código: {code}
            </Badge>
          </Stack>
        ) : (
          <Stack align="center" py="md">
            <ThemeIcon color="red" size={56} radius="xl">
              <IconShieldX size={32} />
            </ThemeIcon>
            <Title order={3}>Certificado inválido</Title>
            <Text c="dimmed" ta="center">
              Não encontramos nenhum certificado com o código <b>{code}</b>. Verifique se o código
              está correto.
            </Text>
          </Stack>
        )}
      </Paper>
    </PublicPage>
  );
}
