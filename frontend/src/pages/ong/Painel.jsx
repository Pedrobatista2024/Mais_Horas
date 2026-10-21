import { Link } from "react-router-dom";
import { Anchor, Box, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconCalendarPlus, IconChevronRight, IconClipboardCheck, IconFilePencil, IconPlus,
  IconUsersGroup,
} from "@tabler/icons-react";

import CapaDoPainel from "../../components/painel/CapaDoPainel";
import Destaque from "../../components/painel/Destaque";
import { DESTAQUE_DA_ONG } from "../../components/painel/destaques";
import DataBloco from "../../components/ui/DataBloco";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { formatHorario } from "../../utils/format";

/**
 * Uma pendência da ONG: só aparece quando existe. Linha com link, não
 * cartão — dá para ler as três de uma vez e ir direto na que importa.
 */
function Pendencia({ icone: Icone, quantidade, singular, plural, para }) {
  if (!quantidade) return null;
  return (
    <Group className="mh-linha" data-clicavel="true" justify="space-between"
           wrap="nowrap" gap="sm" pos="relative">
      <Group gap="sm" wrap="nowrap">
        <Icone size={18} stroke={1.75} color="var(--mh-tinta-3)" aria-hidden="true"
               style={{ flexShrink: 0 }} />
        <Text size="sm" component={Link} to={para} className="mh-link-titulo">
          <Text span fw={600} className="mh-num">{quantidade}</Text>{" "}
          {quantidade === 1 ? singular : plural}
        </Text>
      </Group>
      <IconChevronRight size={16} className="mh-linha-seta" aria-hidden="true" />
    </Group>
  );
}

/**
 * Um número da capa: o valor grande e, embaixo, o que ele conta. No HTML o
 * rótulo vem antes (é o termo da lista); o CSS inverte a ordem na tela.
 */
function NumeroDaCapa({ valor, rotulos: [singular, plural] }) {
  return (
    <div>
      <dt className="mh-capa-rotulo">{valor === 1 ? singular : plural}</dt>
      <dd className="mh-capa-valor mh-num">{valor}</dd>
    </div>
  );
}

/**
 * O1 — Painel da ONG.
 *
 * A capa azul-noite traz os números da organização e, no pé, o destaque (o
 * que fazer agora, escolhido pelo servidor). Embaixo, as próximas atividades
 * e o que está esperando uma decisão. Os atalhos que repetiam o menu lateral
 * saíram.
 */
export default function Painel() {
  const { usuario } = useAuth();
  const painel = useFetch("/painel/ong");
  const proximas = useFetch("/atividades/minhas?situacao=publicada&tamanho=5");

  if (painel.loading || !painel.data) return <Loading label="Carregando seu painel…" />;

  const dados = painel.data;
  const lista = proximas.data?.itens ?? [];
  const temPendencia = dados.inscricoesPendentes + dados.rascunhos
    + dados.aguardandoValidacao > 0;

  return (
    <>
      <CapaDoPainel
        titulo={usuario?.nome ?? "Seu painel"}
        acao={
          <Button component={Link} to="/ong/atividades/nova" variant="outline"
                  color="gray.0" radius="xl" leftSection={<IconPlus size={17} />}>
            Nova atividade
          </Button>
        }
        lateral={
          <dl className="mh-capa-numeros">
            <NumeroDaCapa valor={dados.atividadesPublicadas}
                          rotulos={["atividade no ar", "atividades no ar"]} />
            <NumeroDaCapa valor={dados.voluntariosEngajados}
                          rotulos={["voluntário", "voluntários"]} />
            <NumeroDaCapa valor={dados.certificadosEmitidos}
                          rotulos={["certificado emitido", "certificados emitidos"]} />
          </dl>
        }
        rodape={dados.destaque?.tipo !== "nenhum" && (
          <Destaque destaque={dados.destaque} catalogo={DESTAQUE_DA_ONG} />
        )}
      />

      <Stack gap={36}>
        <SimpleGrid cols={{ base: 1, lg: temPendencia ? 2 : 1 }} spacing={40}
                    verticalSpacing={36}>
          <Box component="section">
            <Group justify="space-between" align="baseline" mb="sm">
              <Title order={2} fz="lg">Próximas atividades</Title>
              <Anchor component={Link} to="/ong/atividades" size="sm">Todas</Anchor>
            </Group>
            {proximas.loading ? (
              <Loading />
            ) : lista.length === 0 ? (
              <EmptyState compacto icon={IconCalendarPlus}
                          title="Nenhuma atividade publicada pela frente"
                          description="Publique uma atividade para receber inscrições." />
            ) : (
              <Box className="mh-lista">
                {lista.map((a) => (
                  <Group key={a.id} className="mh-linha" data-clicavel="true" gap="md"
                         wrap="nowrap" pos="relative">
                    <DataBloco data={a.data} />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} component={Link} to={`/ong/atividades/${a.id}`}
                            className="mh-link-titulo" lineClamp={1}>
                        {a.titulo}
                      </Text>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {formatHorario(a.horaInicio, a.horaFim)}, {a.local}
                      </Text>
                      {/* No celular a contagem desce para não espremer o título. */}
                      <Text size="sm" c="dimmed" className="mh-num" hiddenFrom="sm">
                        {a.vagasOcupadas}/{a.vagasMax} inscritos
                      </Text>
                    </Box>
                    <Text size="sm" c="dimmed" className="mh-num" visibleFrom="sm"
                          style={{ whiteSpace: "nowrap" }}>
                      {a.vagasOcupadas}/{a.vagasMax} inscritos
                    </Text>
                  </Group>
                ))}
              </Box>
            )}
          </Box>

          {temPendencia && (
            <Box component="section">
              <Title order={2} fz="lg" mb="sm">Esperando por você</Title>
              <Box className="mh-lista">
                <Pendencia icone={IconUsersGroup} quantidade={dados.inscricoesPendentes}
                           singular="pedido de inscrição para avaliar"
                           plural="pedidos de inscrição para avaliar"
                           para="/ong/atividades" />
                <Pendencia icone={IconClipboardCheck} quantidade={dados.aguardandoValidacao}
                           singular="atividade esperando validação de presença"
                           plural="atividades esperando validação de presença"
                           para="/ong/atividades?aba=aguardando_validacao" />
                <Pendencia icone={IconFilePencil} quantidade={dados.rascunhos}
                           singular="rascunho não publicado" plural="rascunhos não publicados"
                           para="/ong/atividades?aba=rascunho" />
              </Box>
            </Box>
          )}
        </SimpleGrid>
      </Stack>
    </>
  );
}
