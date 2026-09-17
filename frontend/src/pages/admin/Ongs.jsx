import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge, Button, Card, Center, Group, Pagination, SegmentedControl, Stack, Table,
  Text, TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconBuildingCommunity, IconRosetteDiscountCheck, IconSearch } from "@tabler/icons-react";

import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useListagem } from "../../hooks/useListagem";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

/** A5 — ONGs. */
export default function Ongs() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [pagina, setPagina] = useState(1);
  const [agindo, setAgindo] = useState(null);

  const [buscaAdiada] = useDebouncedValue(busca, 350);
  const params = useMemo(() => ({
    busca: buscaAdiada.trim() || undefined,
    verificada: filtro === "todas" ? undefined : filtro === "verificadas",
    pagina, tamanho: 20,
  }), [buscaAdiada, filtro, pagina]);
  const { dados, carregando, recarregar } = useListagem("/admin/ongs", params);

  async function alternar(ong) {
    setAgindo(ong.id);
    try {
      if (ong.verificada) {
        await api.delete(`/admin/ongs/${ong.id}/verificar`);
        notifySuccess(`Selo removido de ${ong.nome}.`);
      } else {
        await api.post(`/admin/ongs/${ong.id}/verificar`);
        notifySuccess(`${ong.nome} agora aparece como verificada.`);
      }
      recarregar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível alterar o selo"));
    } finally {
      setAgindo(null);
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader eyebrow="Administração" title="Organizações"
                  subtitle="O selo de verificada aparece para os alunos na vitrine." />

      <Group justify="space-between" wrap="wrap" gap="sm">
        <TextInput placeholder="Nome, e-mail ou CNPJ" w={{ base: "100%", sm: 320 }}
                   leftSection={<IconSearch size={16} />} value={busca}
                   onChange={(e) => { setBusca(e.currentTarget.value); setPagina(1); }} />
        <SegmentedControl value={filtro}
                          onChange={(v) => { setFiltro(v); setPagina(1); }}
                          data={[{ value: "todas", label: "Todas" },
                                 { value: "verificadas", label: "Verificadas" },
                                 { value: "pendentes", label: "Sem selo" }]} />
      </Group>

      {carregando ? (
        <Loading label="Carregando organizações..." />
      ) : dados.itens.length === 0 ? (
        <EmptyState icon={IconBuildingCommunity} title="Nenhuma organização encontrada" />
      ) : (
        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Organização</Table.Th>
                  <Table.Th>CNPJ</Table.Th>
                  <Table.Th ta="right">Atividades</Table.Th>
                  <Table.Th ta="right">Voluntários</Table.Th>
                  <Table.Th ta="right">Certificados</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dados.itens.map((ong) => (
                  <Table.Tr key={ong.id}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={600} style={{ cursor: "pointer" }}
                              onClick={() => navegar(`/admin/usuarios/${ong.id}`)}>
                          {ong.nome}
                        </Text>
                        {ong.verificada && (
                          <IconRosetteDiscountCheck size={16}
                                                    color="var(--mantine-color-brand-6)" />
                        )}
                        {ong.situacao === "suspensa" && (
                          <Badge size="xs" color="red">suspensa</Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">{ong.cidade ?? "cidade não informada"}</Text>
                    </Table.Td>
                    <Table.Td>
                      {ong.cnpj ? <Text size="sm">{ong.cnpj}</Text>
                                : <Badge size="xs" color="yellow" variant="light">sem CNPJ</Badge>}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" style={{ cursor: ong.atividades ? "pointer" : "default" }}
                            td={ong.atividades ? "underline" : undefined}
                            onClick={() => ong.atividades
                              && navegar(`/admin/atividades?ongId=${ong.id}`)}>
                        {ong.atividades}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right"><Text size="sm">{ong.voluntarios}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm">{ong.certificados}</Text></Table.Td>
                    <Table.Td ta="right">
                      <Button size="compact-xs" loading={agindo === ong.id}
                              variant={ong.verificada ? "subtle" : "light"}
                              color={ong.verificada ? "gray" : "brand"}
                              onClick={() => alternar(ong)}>
                        {ong.verificada ? "Remover selo" : "Verificar"}
                      </Button>
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
    </Stack>
  );
}
