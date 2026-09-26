import { useNavigate } from "react-router-dom";
import { Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconCalendarEvent, IconCertificate, IconClipboardCheck, IconFilePencil,
  IconPlus, IconUser, IconUsersGroup,
} from "@tabler/icons-react";

import Destaque from "../../components/painel/Destaque";
import { DESTAQUE_DA_ONG } from "../../components/painel/destaques";
import ActionCard from "../../components/ui/ActionCard";
import Loading from "../../components/ui/Loading";
import StatCard from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";

/** Uma pendência da ONG: só aparece quando existe. */
function Pendencia({ icone: Icone, quantidade, singular, plural, para, navegar }) {
  if (!quantidade) return null;
  return (
    <Paper withBorder radius="md" p="md" className="mh-card-hover"
           style={{ cursor: "pointer" }} onClick={() => navegar(para)}>
      <Group gap="sm" wrap="nowrap">
        <Icone size={22} color="var(--mantine-color-navy-6)" style={{ flexShrink: 0 }} />
        <Text size="sm" fw={600}>
          {quantidade} {quantidade === 1 ? singular : plural}
        </Text>
      </Group>
    </Paper>
  );
}

/** O1 — Painel da ONG. */
export default function Painel() {
  const navegar = useNavigate();
  const { usuario } = useAuth();
  const { data, loading } = useFetch("/painel/ong");

  if (loading || !data) return <Loading label="Carregando seu painel..." />;

  const temPendencia = data.inscricoesPendentes + data.rascunhos + data.aguardandoValidacao > 0;

  return (
    <Stack gap="lg">
      <Destaque destaque={data.destaque} catalogo={DESTAQUE_DA_ONG}
                eyebrow={usuario?.nome ?? "Painel da organização"} />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard icon={IconCalendarEvent} label="Atividades no ar"
                  value={data.atividadesPublicadas} color="navy"
                  helper="Publicadas e acontecendo agora" />
        <StatCard icon={IconUsersGroup} label="Voluntários engajados"
                  value={data.voluntariosEngajados}
                  helper="Pessoas diferentes, não inscrições" />
        <StatCard icon={IconCertificate} label="Certificados emitidos"
                  value={data.certificadosEmitidos} color="clay"
                  helper="Sem contar os revogados" />
      </SimpleGrid>

      {temPendencia && (
        <div>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
            Esperando por você
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Pendencia icone={IconUsersGroup} quantidade={data.inscricoesPendentes}
                       singular="pedido de inscrição para avaliar"
                       plural="pedidos de inscrição para avaliar"
                       para="/ong/atividades" navegar={navegar} />
            <Pendencia icone={IconClipboardCheck} quantidade={data.aguardandoValidacao}
                       singular="atividade esperando validação"
                       plural="atividades esperando validação"
                       para="/ong/atividades?aba=aguardando_validacao" navegar={navegar} />
            <Pendencia icone={IconFilePencil} quantidade={data.rascunhos}
                       singular="rascunho não publicado" plural="rascunhos não publicados"
                       para="/ong/atividades?aba=rascunho" navegar={navegar} />
          </SimpleGrid>
        </div>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <ActionCard icon={IconPlus} title="Publicar atividade" color="navy"
                    description="Data, local, carga horária e vagas. Dá para salvar como rascunho."
                    actionLabel="Criar" onClick={() => navegar("/ong/atividades/nova")} />
        <ActionCard icon={IconCalendarEvent} title="Minhas atividades" color="navy"
                    description="Rascunhos, publicadas, acontecendo, a validar e finalizadas."
                    actionLabel="Abrir" onClick={() => navegar("/ong/atividades")} />
        <ActionCard icon={IconUser} title="Perfil da organização"
                    description="Descrição, cidade e logo aparecem na sua página pública."
                    actionLabel="Editar" onClick={() => navegar("/perfil")} />
      </SimpleGrid>
    </Stack>
  );
}
