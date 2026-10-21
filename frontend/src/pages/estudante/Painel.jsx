import { Anchor, Box, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCertificate, IconSearch } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

import Caderneta from "../../components/certificado/Caderneta";
import Destaque from "../../components/painel/Destaque";
import { DESTAQUE_DO_ESTUDANTE } from "../../components/painel/destaques";
import DataBloco from "../../components/ui/DataBloco";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { formatHorario } from "../../utils/format";

const QUANTAS = 4;

/** Título de bloco com o atalho para a tela inteira à direita. */
function Cabecalho({ titulo, para, rotulo }) {
  return (
    <Group justify="space-between" align="baseline" mb="sm">
      <Title order={2} fz="lg">{titulo}</Title>
      <Anchor component={Link} to={para} size="sm">{rotulo}</Anchor>
    </Group>
  );
}

/**
 * E1 — Painel do estudante.
 *
 * Três coisas, nesta ordem: o que precisa ser feito agora (o destaque, que o
 * servidor escolhe), o que vem pela frente e quantas horas já estão
 * garantidas. Os atalhos que repetiam o menu lateral saíram.
 */
export default function Painel() {
  const navegar = useNavigate();
  const { usuario } = useAuth();
  const painel = useFetch("/painel/estudante");
  const proximas = useFetch(`/inscricoes/minhas?grupo=proximas&tamanho=${QUANTAS}`);
  const certificados = useFetch("/certificados/meus?tamanho=5");

  if (painel.loading || !painel.data) return <Loading label="Carregando seu painel…" />;

  const dados = painel.data;
  const primeiroNome = usuario?.nome?.split(" ")[0] ?? "";
  const lista = proximas.data?.itens ?? [];
  const certs = certificados.data?.itens ?? [];

  return (
    <>
      <PageHeader title={primeiroNome ? `Olá, ${primeiroNome}` : "Painel"}>
        <Text c="dimmed" mt={6} className="mh-num">
          {dados.inscricoesAtivas} de {dados.limiteInscricoes} inscrições em uso
        </Text>
      </PageHeader>

      <Stack gap={36}>
        {dados.destaque?.tipo !== "nenhum" && (
          <Destaque destaque={dados.destaque} catalogo={DESTAQUE_DO_ESTUDANTE} />
        )}

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={40} verticalSpacing={36}>
          <Box component="section" aria-labelledby="proximas">
            <Cabecalho titulo="Próximas atividades" para="/minhas-inscricoes"
                       rotulo="Todas as inscrições" />
            {proximas.loading ? (
              <Loading />
            ) : lista.length === 0 ? (
              <EmptyState compacto icon={IconSearch} title="Nada marcado por enquanto"
                          description="Escolha uma vaga e ela aparece aqui."
                          action={{ label: "Buscar atividades",
                                    onClick: () => navegar("/atividades") }} />
            ) : (
              <Box className="mh-lista">
                {lista.map(({ id, atividade }) => (
                  <Group key={id} className="mh-linha" gap="md" wrap="nowrap"
                         pos="relative" data-clicavel="true">
                    <DataBloco data={atividade.data} />
                    <Box style={{ minWidth: 0 }}>
                      <Text fw={600} component={Link} to={`/atividades/${atividade.id}`}
                            className="mh-link-titulo" lineClamp={1}>
                        {atividade.titulo}
                      </Text>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {formatHorario(atividade.horaInicio, atividade.horaFim)},{" "}
                        {atividade.local}
                      </Text>
                    </Box>
                  </Group>
                ))}
              </Box>
            )}
          </Box>

          <Box component="section">
            <Cabecalho titulo="Caderneta de horas" para="/meus-certificados"
                       rotulo="Certificados" />
            {certificados.loading ? (
              <Loading />
            ) : certs.length === 0 ? (
              <EmptyState compacto icon={IconCertificate} title="Nenhuma hora validada ainda"
                          description="Quando a ONG confirmar sua presença, o certificado sai e as horas entram aqui." />
            ) : (
              <Caderneta certificados={certs} total={dados.horasValidadas} />
            )}
          </Box>
        </SimpleGrid>
      </Stack>
    </>
  );
}
