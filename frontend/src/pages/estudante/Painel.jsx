import { useNavigate } from "react-router-dom";
import { Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconCalendarEvent, IconCertificate, IconClock, IconMapPin, IconQrcode,
  IconSearch, IconTicket, IconUser,
} from "@tabler/icons-react";

import Destaque from "../../components/painel/Destaque";
import { DESTAQUE_DO_ESTUDANTE } from "../../components/painel/destaques";
import ActionCard from "../../components/ui/ActionCard";
import Loading from "../../components/ui/Loading";
import StatCard from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { formatDateLong } from "../../utils/format";

/**
 * E1 — Painel do estudante.
 *
 * Os números e o destaque vêm prontos do servidor: a ordem de urgência é
 * regra de negócio, não decisão de tela.
 */
export default function Painel() {
  const navegar = useNavigate();
  const { usuario } = useAuth();
  const { data, loading } = useFetch("/painel/estudante");

  if (loading || !data) return <Loading label="Carregando seu painel..." />;

  const { proximaAtividade: proxima } = data;

  return (
    <Stack gap="lg">
      <Destaque destaque={data.destaque} catalogo={DESTAQUE_DO_ESTUDANTE}
                eyebrow={`Olá, ${usuario?.nome?.split(" ")[0] ?? "estudante"}`} />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard icon={IconClock} label="Horas validadas" value={data.horasValidadas}
                  helper="Somadas dos certificados válidos" />
        <StatCard icon={IconCertificate} label="Certificados" value={data.certificados}
                  color="clay" helper="Prontos para baixar ou compartilhar" />
        <StatCard icon={IconTicket} label="Inscrições ativas" value={data.inscricoesAtivas}
                  color="navy" helper={`Limite de ${data.limiteInscricoes} ao mesmo tempo`} />
      </SimpleGrid>

      {proxima && (
        <Card withBorder radius="md" p="lg" className="mh-card-hover"
              style={{ cursor: "pointer" }}
              onClick={() => navegar(`/atividades/${proxima.id}`)}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
            Sua próxima atividade
          </Text>
          <Title order={3} fz={22} lh={1.2}>{proxima.titulo}</Title>
          <Group gap="lg" mt="sm" wrap="wrap" c="dimmed">
            <Group gap={6} wrap="nowrap">
              <IconCalendarEvent size={16} />
              <Text size="sm">{formatDateLong(proxima.data)}</Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <IconClock size={16} />
              <Text size="sm">{proxima.horaInicio} às {proxima.horaFim}</Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <IconMapPin size={16} />
              <Text size="sm">{proxima.local}</Text>
            </Group>
          </Group>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <ActionCard icon={IconSearch} title="Buscar atividades"
                    description="Vagas abertas das organizações, da data mais próxima em diante."
                    actionLabel="Ver vagas" onClick={() => navegar("/atividades")} />
        <ActionCard icon={IconTicket} title="Minhas inscrições" color="navy"
                    description="Acompanhe o que está por vir, o que aguarda aprovação e o histórico."
                    actionLabel="Abrir" onClick={() => navegar("/minhas-inscricoes")} />
        <ActionCard icon={IconQrcode} title="Fazer check-in" color="clay"
                    description="Escaneie o QR da organização durante a atividade."
                    actionLabel="Abrir câmera" onClick={() => navegar("/check-in")} />
        <ActionCard icon={IconUser} title="Meu perfil"
                    description="Nome completo, instituição e curso são o que sai no certificado."
                    actionLabel="Editar" onClick={() => navegar("/perfil")} />
      </SimpleGrid>
    </Stack>
  );
}
