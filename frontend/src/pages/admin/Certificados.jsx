import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Anchor, Badge, Button, Card, Center, Group, Menu, Pagination, Select, Stack,
  Table, Text, TextInput, Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowBackUp, IconCertificate, IconCircleCheck, IconCircleX, IconDots,
  IconExternalLink, IconRefresh, IconSearch, IconX,
} from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useListagem } from "../../hooks/useListagem";
import { api, mensagemDoErro } from "../../services/api";
import { formatDate } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

/**
 * A7 — Certificados. **Não existe "emitir"** (D14): certificado nasce de
 * presença confirmada, e de mais nada. Revogar exige motivo — ele aparece na
 * verificação pública.
 */
export default function Certificados() {
  const [url] = useSearchParams();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState(null);
  const [assinatura, setAssinatura] = useState(url.get("assinatura"));
  const [pagina, setPagina] = useState(1);
  const [revogando, setRevogando] = useState(null);
  const [revertendo, setRevertendo] = useState(null);

  const [buscaAdiada] = useDebouncedValue(busca, 350);
  const params = useMemo(() => ({
    busca: buscaAdiada.trim() || undefined, situacao: situacao ?? undefined,
    situacaoAssinatura: assinatura ?? undefined, pagina, tamanho: 20,
  }), [buscaAdiada, situacao, assinatura, pagina]);
  const { dados, carregando, recarregar } = useListagem("/admin/certificados", params);

  async function revogar(motivo) {
    try {
      await api.post(`/admin/certificados/${revogando.id}/revogar`, { motivo });
      notifySuccess("Certificado revogado. A verificação pública já mostra o aviso.");
      recarregar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível revogar"));
    }
  }

  async function reverter() {
    try {
      await api.post(`/admin/certificados/${revertendo.id}/reverter-revogacao`);
      notifySuccess("Revogação desfeita. O certificado voltou a valer.");
      recarregar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível reverter"));
    }
  }

  async function reconferir(cert) {
    try {
      const { data } = await api.post(`/admin/certificados/${cert.id}/reconferir`);
      if (data.assinaturaConfere) notifySuccess(`Assinatura de ${cert.codigo} confere.`);
      else notifyError(`A assinatura de ${cert.codigo} NÃO confere: o registro foi alterado.`);
      recarregar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível reconferir"));
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader eyebrow="Administração" title="Certificados"
                  subtitle="Busca, revogação e situação da assinatura de cada certificado." />

      <Card withBorder radius="md" p="md">
        <Group align="flex-end" wrap="wrap" gap="sm">
          <TextInput label="Buscar" placeholder="Código, aluno, ONG ou atividade"
                     w={{ base: "100%", sm: 320 }}
                     leftSection={<IconSearch size={16} />} value={busca}
                     onChange={(e) => { setBusca(e.currentTarget.value); setPagina(1); }} />
          <Select label="Situação" placeholder="Todos" clearable w={{ base: "100%", sm: 170 }}
                  value={situacao} onChange={(v) => { setSituacao(v); setPagina(1); }}
                  data={[{ value: "validos", label: "Não revogados" },
                         { value: "revogados", label: "Revogados" }]} />
          <Select label="Assinatura" placeholder="Qualquer" clearable w={{ base: "100%", sm: 170 }}
                  value={assinatura} onChange={(v) => { setAssinatura(v); setPagina(1); }}
                  data={[{ value: "confere", label: "Confere" },
                         { value: "nao_confere", label: "Não confere" }]} />
        </Group>
      </Card>

      {carregando ? (
        <Loading label="Carregando certificados..." />
      ) : dados.itens.length === 0 ? (
        <EmptyState icon={IconCertificate} title="Nenhum certificado neste recorte" />
      ) : (
        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={780}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Aluno</Table.Th>
                  <Table.Th>Atividade</Table.Th>
                  <Table.Th>Situação</Table.Th>
                  <Table.Th>Assinatura</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dados.itens.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td><Text ff="monospace" size="sm">{c.codigo}</Text></Table.Td>
                    <Table.Td><Text size="sm">{c.aluno}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.atividade}</Text>
                      <Text size="xs" c="dimmed">
                        {c.organizacao} · {formatDate(c.dataAtividade)} · {c.horas}h
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {c.revogado ? (
                        <Tooltip label={c.motivoRevogacao ?? ""} multiline w={260}>
                          <Badge color="yellow" variant="light">revogado</Badge>
                        </Tooltip>
                      ) : <Badge color="brand" variant="light">válido</Badge>}
                    </Table.Td>
                    <Table.Td>
                      {c.assinaturaConfere ? (
                        <Group gap={4} wrap="nowrap">
                          <IconCircleCheck size={16} color="var(--mantine-color-brand-6)" />
                          <Text size="sm">confere</Text>
                        </Group>
                      ) : (
                        <Group gap={4} wrap="nowrap">
                          <IconCircleX size={16} color="var(--mantine-color-red-6)" />
                          <Text size="sm" c="red" fw={700}>adulterado</Text>
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <Button size="compact-sm" variant="subtle"
                                  aria-label={`Ações do certificado ${c.codigo}`}>
                            <IconDots size={16} />
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconExternalLink size={15} />}
                                     component={Anchor} href={`/verificar/${c.codigo}`}
                                     target="_blank" rel="noreferrer">
                            Ver verificação pública
                          </Menu.Item>
                          <Menu.Item leftSection={<IconRefresh size={15} />}
                                     onClick={() => reconferir(c)}>
                            Reconferir assinatura
                          </Menu.Item>
                          <Menu.Divider />
                          {c.revogado ? (
                            <Menu.Item leftSection={<IconArrowBackUp size={15} />}
                                       onClick={() => setRevertendo(c)}>
                              Reverter revogação
                            </Menu.Item>
                          ) : (
                            <Menu.Item color="red" leftSection={<IconX size={15} />}
                                       onClick={() => setRevogando(c)}>
                              Revogar
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      {dados.paginas > 1 && (
        <Center>
          <Pagination total={dados.paginas} value={pagina} onChange={setPagina} />
        </Center>
      )}

      <ConfirmarAcao
        aberto={Boolean(revogando)}
        aoFechar={() => setRevogando(null)}
        titulo="Revogar certificado"
        mensagem={`O certificado ${revogando?.codigo} de ${revogando?.aluno} deixa de valer. O registro permanece e a verificação pública passa a mostrar a revogação, com data e motivo.`}
        rotuloConfirmar="Revogar"
        motivoObrigatorio
        descricaoMotivo="Aparece na verificação pública e no aviso ao aluno."
        aoConfirmar={revogar}
      />

      <ConfirmarAcao
        aberto={Boolean(revertendo)}
        aoFechar={() => setRevertendo(null)}
        titulo="Reverter revogação"
        mensagem={`O certificado ${revertendo?.codigo} volta a valer e o aluno é avisado.`}
        rotuloConfirmar="Reverter"
        cor="brand"
        aoConfirmar={reverter}
      />
    </Stack>
  );
}
