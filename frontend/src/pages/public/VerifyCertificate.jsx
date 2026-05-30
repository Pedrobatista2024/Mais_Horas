import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Center, Divider, Group, Loader, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconBuildingCommunity,
  IconCalendar,
  IconHourglass,
  IconShieldCheck,
  IconShieldX,
  IconUser,
} from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import InfoItem from "../../components/ui/InfoItem";
import { api } from "../../services/api";
import { formatDate } from "../../utils/format";

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
      <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} shadow="sm" className="mh-page-band">
        {state.loading ? (
          <Center py="xl">
            <Loader color="brand" />
          </Center>
        ) : state.valid ? (
          <Stack>
            <Group>
              <ThemeIcon color="brand" size={58} radius="md">
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

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
              <InfoItem icon={IconUser} label="Estudante" value={state.cert.user?.name} />
              <InfoItem icon={IconBuildingCommunity} label="Atividade" value={state.cert.activity?.title} />
              <InfoItem
                icon={IconBuildingCommunity}
                label="Organização"
                value={state.cert.activity?.createdBy?.name || "-"}
              />
              <InfoItem icon={IconHourglass} label="Carga horária" value={`${state.cert.hours}h`} />
              <InfoItem
                icon={IconCalendar}
                label="Data da atividade"
                value={formatDate(state.cert.activity?.date)}
              />
            </SimpleGrid>

            <Badge variant="light" color="gray" radius="sm" mt="xs">
              Código: {code}
            </Badge>
          </Stack>
        ) : (
          <Stack align="center" py="md">
            <ThemeIcon color="red" size={58} radius="md">
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
