import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Center, Group, Pagination, SimpleGrid, Stack, Text,
  ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle, IconCertificate, IconCopy, IconDownload, IconExternalLink,
  IconLink,
} from "@tabler/icons-react";

import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { baixarArquivo } from "../../utils/baixar";
import { formatDate } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

const TAMANHO = 12;

async function copiar(texto, aviso) {
  try {
    await navigator.clipboard.writeText(texto);
    notifySuccess(aviso);
  } catch {
    notifyError("Seu navegador não deixou copiar. Selecione e copie manualmente.");
  }
}

/**
 * E6 — Meus certificados.
 *
 * "Ver verificação" abre exatamente a página que a coordenação vai ver: o aluno
 * confere antes de entregar, em vez de descobrir um problema depois.
 */
export default function MeusCertificados() {
  const navegar = useNavigate();

  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({
    itens: [], total: 0, paginas: 1, horasValidas: 0,
  });
  const [baixando, setBaixando] = useState(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/certificados/meus", {
        params: { pagina, tamanho: TAMANHO },
      });
      setResultado(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar seus certificados"));
    } finally {
      setCarregando(false);
    }
  }, [pagina]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  async function baixar(cert) {
    setBaixando(cert.id);
    try {
      await baixarArquivo(`/certificados/${cert.id}/pdf`,
                          `certificado-${cert.codigo}.pdf`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro,
        "Não foi possível gerar o arquivo. Tente novamente."));
    } finally {
      setBaixando(null);
    }
  }

  if (carregando) return <Loading label="Carregando certificados..." />;

  const { itens, horasValidas } = resultado;

  return (
    <>
      <PageHeader
        eyebrow="Estudante"
        title="Meus certificados"
        subtitle="Cada certificado é assinado digitalmente e pode ser conferido por qualquer pessoa pelo QR Code."
      />

      {itens.length === 0 ? (
        <EmptyState
          icon={IconCertificate}
          title="Nenhum certificado ainda"
          description="O certificado nasce quando a organização confirma sua presença numa atividade. Participe de uma e ele aparece aqui."
          action={{ label: "Buscar atividades", onClick: () => navegar("/atividades") }}
        />
      ) : (
        <Stack gap="lg">
          <Card withBorder radius="md" p={{ base: "md", sm: "lg" }}>
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={48} radius="md" variant="light" color="brand">
                <IconCertificate size={26} />
              </ThemeIcon>
              <div>
                <Text size="sm" c="dimmed">
                  Horas comprovadas
                </Text>
                <Title order={2} lh={1.1}>
                  {horasValidas} {horasValidas === 1 ? "hora" : "horas"}
                </Title>
              </div>
            </Group>
          </Card>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {itens.map((cert) => (
              <Card key={cert.id} withBorder radius="md" padding="lg" h="100%">
                <Stack gap="sm" h="100%">
                  <Group justify="space-between" align="flex-start" wrap="nowrap"
                         gap="xs">
                    <div style={{ minWidth: 0 }}>
                      <Title order={4} fz={17} lineClamp={2}>
                        {cert.atividade}
                      </Title>
                      <Text size="xs" c="dimmed" truncate>
                        {cert.organizacao}
                      </Text>
                    </div>
                    <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
                      <Badge color={cert.revogado ? "red" : "brand"} variant="light"
                             radius="sm">
                        {cert.revogado ? "Revogado" : "Válido"}
                      </Badge>
                      <Badge color="clay" variant="light" radius="sm">
                        {cert.horas}h
                      </Badge>
                    </Stack>
                  </Group>

                  <Text size="sm" c="dimmed">
                    Atividade em {formatDate(cert.dataAtividade)}
                  </Text>

                  <Group gap={6} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      Código
                    </Text>
                    <Text ff="monospace" size="sm" fw={600}>
                      {cert.codigo}
                    </Text>
                    <Tooltip label="Copiar código">
                      <Button size="compact-xs" variant="subtle" px={4}
                              aria-label="Copiar código"
                              onClick={() => copiar(cert.codigo, "Código copiado")}>
                        <IconCopy size={14} />
                      </Button>
                    </Tooltip>
                  </Group>

                  {cert.revogado && (
                    <Alert color="red" variant="light" p="xs"
                           icon={<IconAlertTriangle size={16} />}>
                      <Text size="xs">
                        Este certificado foi invalidado. O arquivo continua
                        disponível, mas a verificação vai acusar a revogação.
                      </Text>
                    </Alert>
                  )}

                  <Stack gap={6} mt="auto" pt={4}>
                    <Button size="compact-sm" leftSection={<IconDownload size={14} />}
                            loading={baixando === cert.id}
                            onClick={() => baixar(cert)}>
                      Baixar PDF
                    </Button>
                    <Group gap={6} grow>
                      <Button size="compact-sm" variant="light"
                              leftSection={<IconExternalLink size={14} />}
                              onClick={() => navegar(`/verificar/${cert.codigo}`)}>
                        Ver verificação
                      </Button>
                      <Button size="compact-sm" variant="light"
                              leftSection={<IconLink size={14} />}
                              onClick={() => copiar(cert.urlVerificacao,
                                                    "Link de verificação copiado")}>
                        Copiar link
                      </Button>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          {resultado.paginas > 1 && (
            <Center>
              <Pagination total={resultado.paginas} value={pagina} onChange={setPagina} />
            </Center>
          )}
        </Stack>
      )}
    </>
  );
}
