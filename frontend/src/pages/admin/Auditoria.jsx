import { Fragment, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Anchor, Badge, Button, Card, Center, Code, Group, Pagination, SimpleGrid,
  Stack, Switch, Table, Text, TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconChevronDown, IconChevronRight, IconDownload, IconFilterOff, IconListSearch,
} from "@tabler/icons-react";

import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useListagem } from "../../hooks/useListagem";
import { mensagemDoErro } from "../../services/api";
import { baixarArquivo } from "../../utils/baixar";
import { notifyError } from "../../utils/notify";

const TAMANHO = 50;

function paraIso(data) {
  if (!data) return undefined;
  const d = typeof data === "string" ? new Date(`${data}T00:00:00`) : data;
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function Json({ rotulo, valor }) {
  if (!valor) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <Text size="xs" c="dimmed" mb={4}>{rotulo}</Text>
      <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(valor, null, 2)}
      </Code>
    </div>
  );
}

/**
 * A2 — Auditoria. **Somente leitura**: não há botão de editar nem de apagar,
 * porque não há rota para isso (RN-33). Consultar também é registrado.
 */
export default function Auditoria() {
  const [url] = useSearchParams();

  const [acao, setAcao] = useState(url.get("acao") ?? "");
  const [ip, setIp] = useState("");
  const [periodo, setPeriodo] = useState([null, null]);
  const [apenasAdmin, setApenasAdmin] = useState(false);
  const [apenasEmNomeDe, setApenasEmNomeDe] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState(null);
  const [baixando, setBaixando] = useState(false);

  const alvoId = url.get("alvoId") ?? undefined;
  const [acaoAdiada] = useDebouncedValue(acao, 400);
  const [ipAdiado] = useDebouncedValue(ip, 400);

  const filtros = useMemo(() => ({
    acao: acaoAdiada.trim() || undefined,
    ip: ipAdiado.trim() || undefined,
    de: paraIso(periodo[0]),
    ate: paraIso(periodo[1]),
    apenasAdmin: apenasAdmin || undefined,
    apenasEmNomeDe: apenasEmNomeDe || undefined,
    alvoId,
  }), [acaoAdiada, ipAdiado, periodo, apenasAdmin, apenasEmNomeDe, alvoId]);

  const params = useMemo(() => ({ ...filtros, pagina, tamanho: TAMANHO }),
                         [filtros, pagina]);
  const { dados, carregando } = useListagem("/admin/auditoria", params);

  function mudar(setter) {
    return (valor) => { setter(valor); setPagina(1); };
  }

  function limpar() {
    setAcao(""); setIp(""); setPeriodo([null, null]);
    setApenasAdmin(false); setApenasEmNomeDe(false); setPagina(1);
  }

  async function exportar() {
    setBaixando(true);
    try {
      await baixarArquivo("/admin/auditoria/exportar", "auditoria.csv", filtros);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível exportar"));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Administração"
        title="Auditoria"
        subtitle="Tudo o que acontece no sistema, em ordem do mais recente. Somente leitura."
        action={
          <Button variant="light" leftSection={<IconDownload size={16} />}
                  loading={baixando} disabled={!dados.total} onClick={exportar}>
            Exportar CSV
          </Button>
        }
      />

      {alvoId && (
        <Group gap="xs">
          <Badge variant="light">Filtrado por um usuário</Badge>
          <Anchor component={Link} to="/admin/auditoria" size="sm">remover</Anchor>
        </Group>
      )}

      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Ação" placeholder="conta.suspensa ou sessao."
                       description="Termine com ponto para a família inteira"
                       value={acao} onChange={(e) => mudar(setAcao)(e.currentTarget.value)} />
            <DatePickerInput type="range" label="Período" placeholder="De — até"
                             valueFormat="DD/MM/YYYY" clearable
                             value={periodo} onChange={mudar(setPeriodo)} />
            <TextInput label="IP" placeholder="200.1.2.3"
                       value={ip} onChange={(e) => mudar(setIp)(e.currentTarget.value)} />
          </SimpleGrid>
          <Group justify="space-between" wrap="wrap">
            <Group gap="lg">
              <Switch label="Só ações de admin" checked={apenasAdmin}
                      onChange={(e) => mudar(setApenasAdmin)(e.currentTarget.checked)} />
              <Switch label='Só via "entrar como"' checked={apenasEmNomeDe}
                      onChange={(e) => mudar(setApenasEmNomeDe)(e.currentTarget.checked)} />
            </Group>
            <Button variant="subtle" size="compact-sm"
                    leftSection={<IconFilterOff size={15} />} onClick={limpar}>
              Limpar filtros
            </Button>
          </Group>
        </Stack>
      </Card>

      {carregando ? (
        <Loading label="Consultando a trilha..." />
      ) : dados.itens.length === 0 ? (
        <EmptyState icon={IconListSearch} title="Nenhum registro neste recorte"
                    description="Tente ampliar o período ou limpar os filtros." />
      ) : (
        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={28} />
                  <Table.Th>Quando</Table.Th>
                  <Table.Th>Ação</Table.Th>
                  <Table.Th>Quem</Table.Th>
                  <Table.Th>Entidade</Table.Th>
                  <Table.Th>IP</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dados.itens.map((r) => {
                  const expandida = aberta === r.id;
                  return (
                    <Fragment key={r.id}>
                      <Table.Tr style={{ cursor: "pointer" }}
                                onClick={() => setAberta(expandida ? null : r.id)}>
                        <Table.Td>
                          {expandida ? <IconChevronDown size={14} />
                                     : <IconChevronRight size={14} />}
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">
                            {new Date(r.ocorridoEm).toLocaleString("pt-BR")}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Code>{r.acao}</Code>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            {r.atorId ? (
                              <Anchor component={Link} size="sm"
                                      to={`/admin/usuarios/${r.atorId}`}
                                      onClick={(e) => e.stopPropagation()}>
                                {r.atorNome ?? "conta removida"}
                              </Anchor>
                            ) : <Text size="sm" c="dimmed">visitante</Text>}
                            {r.atorPapel === "superadmin" && (
                              <Badge size="xs" color="grape">admin</Badge>)}
                            {r.emNomeDeId && (
                              <Badge size="xs" color="orange">
                                como {r.emNomeDeNome ?? "?"}
                              </Badge>)}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{r.entidade ?? "—"}</Text>
                        </Table.Td>
                        <Table.Td><Text size="xs">{r.ip ?? "—"}</Text></Table.Td>
                      </Table.Tr>
                      {expandida && (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <SimpleGrid cols={{ base: 1, sm: 2 }} p="xs">
                              <Json rotulo="Antes" valor={r.antes} />
                              <Json rotulo="Depois" valor={r.depois} />
                            </SimpleGrid>
                            <Text size="xs" c="dimmed" px="xs">
                              {r.entidade && `${r.entidade} ${r.entidadeId ?? ""} · `}
                              {r.userAgent ?? "sem navegador registrado"}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">{dados.total} registro(s)</Text>
        {dados.paginas > 1 && (
          <Center>
            <Pagination total={dados.paginas} value={pagina} onChange={setPagina} />
          </Center>
        )}
      </Group>
    </Stack>
  );
}
