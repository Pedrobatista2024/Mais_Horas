import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ActionIcon, Badge, Box, Button, Center, Group, Menu, Pagination, Stack, Text,
} from "@mantine/core";
import {
  IconCertificate, IconCopy, IconDots, IconDownload, IconExternalLink, IconLink,
} from "@tabler/icons-react";

import EmptyState from "../../components/ui/EmptyState";
import Horas from "../../components/ui/Horas";
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
 * Uma linha por certificado, com as horas alinhadas à direita e o total
 * embaixo, como na caderneta do painel. A ação principal é baixar o PDF; o
 * resto (abrir a verificação, copiar link ou código) fica no menu.
 *
 * "Abrir verificação" mostra exatamente a página que a coordenação vai ver: o
 * aluno confere antes de entregar, em vez de descobrir um problema depois.
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
      await baixarArquivo(`/certificados/${cert.id}/pdf`, `certificado-${cert.codigo}.pdf`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível gerar o arquivo. Tente de novo."));
    } finally {
      setBaixando(null);
    }
  }

  if (carregando) return <Loading label="Carregando certificados…" />;

  const { itens, horasValidas } = resultado;

  return (
    <>
      <PageHeader
        title="Certificados"
        subtitle="Cada certificado é assinado digitalmente. Quem recebe confere pelo QR Code ou pelo código, sem precisar de conta."
      />

      {itens.length === 0 ? (
        <EmptyState
          icon={IconCertificate}
          title="Nenhum certificado ainda"
          description="O certificado sai quando a organização confirma sua presença numa atividade."
          action={{ label: "Buscar atividades", onClick: () => navegar("/atividades") }}
        />
      ) : (
        <Stack gap="lg">
          <Box className="mh-lista">
            {itens.map((cert) => (
              <Group key={cert.id} className="mh-linha" gap="md" wrap="nowrap"
                     align="flex-start">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" wrap="wrap">
                    <Text fw={600}>{cert.atividade}</Text>
                    {cert.revogado && <Badge color="red">Revogado</Badge>}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {cert.organizacao}, {formatDate(cert.dataAtividade)}
                  </Text>
                  <Group gap={4} mt={6} wrap="nowrap">
                    <Text size="sm" c="dimmed">Código</Text>
                    <Text size="sm" ff="monospace" fw={500} translate="no">{cert.codigo}</Text>
                    <ActionIcon size="sm" variant="subtle" color="gray"
                                aria-label={`Copiar o código ${cert.codigo}`}
                                onClick={() => copiar(cert.codigo, "Código copiado")}>
                      <IconCopy size={14} />
                    </ActionIcon>
                  </Group>
                  {cert.revogado && (
                    <Text size="sm" c="red.8" mt={6} maw={560}>
                      Este certificado foi invalidado. O arquivo continua disponível, mas
                      a verificação vai mostrar a revogação.
                    </Text>
                  )}
                  <Group gap="xs" mt="sm">
                    <Button size="xs" variant={cert.revogado ? "default" : "filled"}
                            leftSection={<IconDownload size={15} />}
                            loading={baixando === cert.id} onClick={() => baixar(cert)}>
                      Baixar PDF
                    </Button>
                    <Menu position="bottom-start" shadow="sm" width={230}>
                      <Menu.Target>
                        <ActionIcon variant="default" size={30}
                                    aria-label={`Mais opções: ${cert.atividade}`}>
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconExternalLink size={15} />}
                                   component={Link} to={`/verificar/${cert.codigo}`}>
                          Abrir a verificação
                        </Menu.Item>
                        <Menu.Item leftSection={<IconLink size={15} />}
                                   onClick={() => copiar(cert.urlVerificacao,
                                                         "Link de verificação copiado")}>
                          Copiar link de verificação
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Box>
                <Text fw={500} className="mh-num" td={cert.revogado ? "line-through" : undefined}
                      c={cert.revogado ? "dimmed" : undefined} style={{ whiteSpace: "nowrap" }}>
                  {cert.horas} h
                </Text>
              </Group>
            ))}
            <Group className="mh-linha" justify="space-between"
                   style={{ borderTop: "3px double var(--mh-tinta)" }}>
              <Text fw={600}>Total validado</Text>
              <Horas valor={horasValidas} style={{ fontSize: "0.9375rem" }} />
            </Group>
          </Box>

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
