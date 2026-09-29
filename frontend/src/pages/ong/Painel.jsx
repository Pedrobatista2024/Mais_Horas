import { useNavigate } from "react-router-dom";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconCalendarEvent, IconCertificate, IconChevronRight, IconClipboardCheck,
  IconFilePencil, IconPlus, IconUser, IconUsersGroup,
} from "@tabler/icons-react";

import Destaque from "../../components/painel/Destaque";
import { DESTAQUE_DA_ONG } from "../../components/painel/destaques";
import ActionCard from "../../components/ui/ActionCard";
import Loading from "../../components/ui/Loading";
import StatCard from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";

/**
 * Uma pendência da ONG: só aparece quando existe.
 *
 * Linha, e não cartão: três cartões lado a lado dizendo "2 rascunhos" viram
 * enfeite, e a tela inteira já é feita de cartões. Em linha dá para ler as
 * três de uma vez e clicar na que importa.
 */
function Pendencia({ icone: Icone, quantidade, singular, plural, para, navegar }) {
  if (!quantidade) return null;
  return (
    <Box className="mh-linha" role="button" tabIndex={0}
         onClick={() => navegar(para)}
         onKeyDown={(e) => { if (e.key === "Enter") navegar(para); }}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap">
          <Icone size={17} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
          <Text size="sm">
            <Text span fw={600}>{quantidade}</Text>{" "}
            {quantidade === 1 ? singular : plural}
          </Text>
        </Group>
        <IconChevronRight size={16} className="mh-linha-seta" />
      </Group>
    </Box>
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
                  value={data.atividadesPublicadas}
                  helper="Publicadas e acontecendo agora" />
        <StatCard icon={IconUsersGroup} label="Voluntários engajados"
                  value={data.voluntariosEngajados}
                  helper="Pessoas diferentes, não inscrições" />
        <StatCard icon={IconCertificate} label="Certificados emitidos"
                  value={data.certificadosEmitidos}
                  helper="Sem contar os revogados" />
      </SimpleGrid>

      {temPendencia && (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Esperando por você
          </Text>
          <Box className="mh-lista">
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
          </Box>
        </Stack>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <ActionCard icon={IconPlus} title="Publicar atividade"
                    description="Data, local, carga horária e vagas. Dá para salvar como rascunho."
                    actionLabel="Criar" onClick={() => navegar("/ong/atividades/nova")} />
        <ActionCard icon={IconCalendarEvent} title="Minhas atividades"
                    description="Rascunhos, publicadas, acontecendo, a validar e finalizadas."
                    actionLabel="Abrir" onClick={() => navegar("/ong/atividades")} />
        <ActionCard icon={IconUser} title="Perfil da organização"
                    description="Descrição, cidade e logo aparecem na sua página pública."
                    actionLabel="Editar" onClick={() => navegar("/perfil")} />
      </SimpleGrid>
    </Stack>
  );
}
