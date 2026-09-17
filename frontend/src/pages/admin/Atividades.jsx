import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Center, Group, Menu, Modal, NumberInput, Pagination,
  Radio, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconAlertTriangle, IconCalendarEvent, IconDots, IconEdit, IconGavel, IconSearch, IconX,
} from "@tabler/icons-react";

import SituacaoBadge from "../../components/atividade/SituacaoBadge";
import { SITUACOES } from "../../components/atividade/situacoes";
import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useListagem } from "../../hooks/useListagem";
import { api, mensagemDoErro } from "../../services/api";
import { formatDate } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

const CAMPOS = ["titulo", "local", "cidade", "data", "hora_inicio", "hora_fim",
                "carga_horaria", "vagas_max"];

function valoresDe(a) {
  return {
    titulo: a.titulo, local: a.local, cidade: a.cidade ?? "", data: a.data,
    hora_inicio: a.horaInicio, hora_fim: a.horaFim,
    carga_horaria: a.cargaHoraria, vagas_max: a.vagasMax,
  };
}

/**
 * Edição administrativa. Fica **visível** para a ONG e para os inscritos
 * (RN-35), e por isso o aviso vem antes de qualquer campo.
 */
function EditarAtividade({ atividade, aoFechar, aoSalvar }) {
  const original = useMemo(() => valoresDe(atividade), [atividade]);
  const [valores, setValores] = useState(original);
  const [salvando, setSalvando] = useState(false);

  function campo(nome) {
    return (evento) => {
      const valor = evento?.currentTarget ? evento.currentTarget.value : evento;
      setValores((atual) => ({ ...atual, [nome]: valor }));
    };
  }

  async function salvar() {
    const alterados = Object.fromEntries(
      CAMPOS.filter((c) => valores[c] !== original[c]).map((c) => [c, valores[c]]));
    if (Object.keys(alterados).length === 0) {
      aoFechar();
      return;
    }
    setSalvando(true);
    try {
      await api.put(`/admin/atividades/${atividade.id}`, alterados);
      notifySuccess("Atividade corrigida. A edição aparece como administrativa.");
      aoSalvar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível salvar"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal opened onClose={aoFechar} title="Editar como administração" centered size="lg">
      <Stack gap="sm">
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
          A atividade vai exibir “editada pela administração” para a organização e
          para os inscritos. Com gente inscrita, mudar data ou local afeta quem já
          se programou.
        </Alert>
        <TextInput label="Título" maxLength={40} value={valores.titulo}
                   onChange={campo("titulo")} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Local" maxLength={50} value={valores.local}
                     onChange={campo("local")} />
          <TextInput label="Cidade" value={valores.cidade} onChange={campo("cidade")} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Data" type="date" value={valores.data}
                     onChange={campo("data")} />
          <TimeInput label="Início" value={valores.hora_inicio}
                     onChange={campo("hora_inicio")} />
          <TimeInput label="Término" value={valores.hora_fim}
                     onChange={campo("hora_fim")} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput label="Carga horária" min={1} max={24}
                       value={valores.carga_horaria} onChange={campo("carga_horaria")} />
          <NumberInput label="Máximo de vagas" min={1}
                       description={`${atividade.vagasOcupadas} já ocupada(s)`}
                       value={valores.vagas_max} onChange={campo("vagas_max")} />
        </SimpleGrid>
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={aoFechar}>Voltar</Button>
          <Button onClick={salvar} loading={salvando}>Salvar correção</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** A6 — Atividades de todas as organizações. */
export default function Atividades() {
  const [url] = useSearchParams();
  const ongId = url.get("ongId") ?? undefined;

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState(null);
  const [paradas, setParadas] = useState(url.get("paradas") === "1");
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [forcando, setForcando] = useState(null);
  const [politica, setPolitica] = useState("checkin_presente");

  const [buscaAdiada] = useDebouncedValue(busca, 350);
  const params = useMemo(() => ({
    busca: buscaAdiada.trim() || undefined, situacao: situacao ?? undefined,
    paradas: paradas || undefined, ongId, pagina, tamanho: 20,
  }), [buscaAdiada, situacao, paradas, ongId, pagina]);
  const { dados, carregando, recarregar } = useListagem("/admin/atividades", params);

  async function cancelar(motivo) {
    try {
      await api.post(`/admin/atividades/${cancelando.id}/cancelar`, { motivo });
      notifySuccess("Atividade cancelada. Os inscritos foram avisados.");
      recarregar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
    }
  }

  async function forcar(motivo) {
    try {
      const { data } = await api.post(
        `/admin/atividades/${forcando.id}/forcar-validacao`, { motivo, politica });
      notifySuccess(`Atividade finalizada: ${data.certificadosEmitidos} certificado(s) emitido(s).`);
      recarregar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível forçar a validação"));
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader eyebrow="Administração" title="Atividades"
                  subtitle="De todas as organizações. Correções ficam visíveis e registradas." />

      <Card withBorder radius="md" p="md">
        <Group align="flex-end" wrap="wrap" gap="sm">
          <TextInput label="Buscar" placeholder="Título, local ou cidade"
                     w={{ base: "100%", sm: 280 }}
                     leftSection={<IconSearch size={16} />} value={busca}
                     onChange={(e) => { setBusca(e.currentTarget.value); setPagina(1); }} />
          <Select label="Situação" placeholder="Todas" clearable w={{ base: "100%", sm: 200 }}
                  value={situacao} onChange={(v) => { setSituacao(v); setPagina(1); }}
                  data={Object.entries(SITUACOES).map(([value, s]) => ({ value, label: s.rotulo }))} />
          <Switch label="Paradas há mais de 7 dias" checked={paradas} mb={6}
                  onChange={(e) => { setParadas(e.currentTarget.checked); setPagina(1); }} />
          {ongId && <Badge variant="light" mb={8}>Filtrado por organização</Badge>}
        </Group>
      </Card>

      {carregando ? (
        <Loading label="Carregando atividades..." />
      ) : dados.itens.length === 0 ? (
        <EmptyState icon={IconCalendarEvent} title="Nenhuma atividade neste recorte" />
      ) : (
        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Atividade</Table.Th>
                  <Table.Th>Organização</Table.Th>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Situação</Table.Th>
                  <Table.Th ta="right">Vagas</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dados.itens.map((a) => {
                  const editavel = !["finalizada", "cancelada"].includes(a.situacao);
                  const cancelavel = ["rascunho", "publicada", "em_andamento"].includes(a.situacao);
                  return (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>{a.titulo}</Text>
                        <Text size="xs" c="dimmed">{a.local}{a.cidade ? ` · ${a.cidade}` : ""}</Text>
                        {a.editadaPorAdminEm && (
                          <Badge size="xs" color="orange" variant="light">editada pela administração</Badge>
                        )}
                      </Table.Td>
                      <Table.Td><Text size="sm">{a.ong.nome}</Text></Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(a.data)}</Text>
                        <Text size="xs" c="dimmed">{a.horaInicio}–{a.horaFim}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <SituacaoBadge situacao={a.situacao} />
                          {a.podeForcarValidacao && (
                            <Badge size="xs" color="red" variant="filled">parada</Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{a.vagasOcupadas}/{a.vagasMax}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <Button size="compact-sm" variant="subtle"
                                    aria-label={`Ações de ${a.titulo}`}>
                              <IconDots size={16} />
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconEdit size={15} />}
                                       disabled={!editavel} onClick={() => setEditando(a)}>
                              Editar
                            </Menu.Item>
                            <Menu.Item leftSection={<IconGavel size={15} />}
                                       disabled={!a.podeForcarValidacao}
                                       onClick={() => { setPolitica("checkin_presente"); setForcando(a); }}>
                              Forçar validação
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item color="red" leftSection={<IconX size={15} />}
                                       disabled={!cancelavel} onClick={() => setCancelando(a)}>
                              Cancelar atividade
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
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

      {editando && (
        <EditarAtividade atividade={editando} aoFechar={() => setEditando(null)}
                         aoSalvar={() => { setEditando(null); recarregar(); }} />
      )}

      <ConfirmarAcao
        aberto={Boolean(cancelando)}
        aoFechar={() => setCancelando(null)}
        titulo="Cancelar atividade"
        mensagem={`"${cancelando?.titulo}" será cancelada e os ${cancelando?.vagasOcupadas ?? 0} inscrito(s) serão avisados. Não dá para reabrir.`}
        rotuloConfirmar="Cancelar atividade"
        motivoObrigatorio
        descricaoMotivo="Fica na auditoria. O aviso aos alunos não repete o motivo."
        aoConfirmar={cancelar}
      />

      <ConfirmarAcao
        aberto={Boolean(forcando)}
        aoFechar={() => setForcando(null)}
        titulo="Forçar validação"
        mensagem={`A organização não validou "${forcando?.titulo}" em 7 dias. A política vale só para quem ainda está sem decisão; o que a organização já marcou é respeitado. Certificados serão emitidos e isso não pode ser desfeito.`}
        rotuloConfirmar="Forçar e finalizar"
        cor="orange"
        motivoObrigatorio
        descricaoMotivo="Fica na auditoria junto com a política escolhida."
        aoConfirmar={forcar}
      >
        <Radio.Group label="Política" value={politica} onChange={setPolitica}>
          <Stack gap={6} mt={6}>
            <Radio value="checkin_presente"
                   label="Quem fez check-in é presente; os demais, ausentes" />
            <Radio value="todos_ausentes" label="Todos sem decisão ficam ausentes" />
          </Stack>
        </Radio.Group>
      </ConfirmarAcao>
    </Stack>
  );
}
