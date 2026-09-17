import { useEffect, useState } from "react";
import {
  Alert, Badge, Button, Card, Code, Group, SimpleGrid, Stack, Table, Text,
} from "@mantine/core";
import {
  IconAlertOctagon, IconCircleCheck, IconDownload, IconKey, IconShieldSearch,
  IconTrash,
} from "@tabler/icons-react";

import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { baixarArquivo } from "../../utils/baixar";
import { notifyError, notifySuccess } from "../../utils/notify";

const PARAMETROS = [
  ["janelaDoCheckinSegundos", "Janela do QR de check-in", "s"],
  ["folgaDoCheckinSegundos", "Folga após a janela", "s"],
  ["accessTokenMinutos", "Validade do access token", "min"],
  ["refreshTokenDias", "Validade da sessão", "dias"],
  ["verificacoesPorMinuto", "Verificações públicas por IP", "/min"],
  ["inscricoesAtivasMaximo", "Inscrições ativas por aluno", ""],
  ["uploadMaximoBytes", "Tamanho máximo de upload", "bytes"],
  ["ambiente", "Ambiente", ""],
];

/**
 * A8 — Sistema.
 *
 * Rotacionar a chave **não** é botão: trocar a chave invalidaria todo
 * certificado já emitido. É operação de servidor, planejada.
 */
export default function Sistema() {
  const [info, setInfo] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [limpando, setLimpando] = useState(false);

  useEffect(() => {
    api.get("/admin/sistema")
      .then(({ data }) => setInfo(data))
      .catch((erro) => notifyError(mensagemDoErro(erro, "Não foi possível carregar")));
  }, []);

  async function verificar() {
    setVerificando(true);
    try {
      const { data } = await api.post("/admin/sistema/verificar-integridade");
      setRelatorio(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível verificar"));
    } finally {
      setVerificando(false);
    }
  }

  async function limpar() {
    setLimpando(true);
    try {
      const { data } = await api.post("/admin/sistema/limpar-tokens");
      notifySuccess(`Removidos: ${data.sessoes} sessão(ões) e ${data.redefinicoes} link(s) vencidos.`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível limpar"));
    } finally {
      setLimpando(false);
    }
  }

  async function baixarChave() {
    try {
      await baixarArquivo("/admin/sistema/chave-publica", "mais-horas-chave-publica.pem");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível baixar a chave"));
    }
  }

  if (!info) return <Loading label="Carregando..." />;

  return (
    <Stack gap="lg" maw={960}>
      <PageHeader eyebrow="Administração" title="Sistema"
                  subtitle="Chave de assinatura, parâmetros e manutenção." />

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="lg">
          <Group gap="xs" mb="sm">
            <IconKey size={18} />
            <Text fw={700}>Chave de assinatura</Text>
          </Group>
          {info.chave.configurada ? (
            <Stack gap="xs">
              <Text size="sm">Algoritmo <b>{info.chave.algoritmo}</b></Text>
              <Text size="sm">Impressão digital</Text>
              <Code>{info.chave.impressaoDigital}</Code>
              <Text size="xs" c="dimmed">
                A mesma que aparece no rodapé de cada certificado emitido.
              </Text>
              <Button variant="light" size="compact-sm" w="fit-content" mt="xs"
                      leftSection={<IconDownload size={15} />} onClick={baixarChave}>
                Baixar chave pública
              </Button>
            </Stack>
          ) : (
            <Alert color="red" variant="light">
              Sem chave configurada: nenhum certificado pode ser emitido.
            </Alert>
          )}
        </Card>

        <Card withBorder radius="md" p="lg">
          <Text fw={700} mb="sm">Parâmetros</Text>
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {PARAMETROS.map(([chave, rotulo, unidade]) => (
                <Table.Tr key={chave}>
                  <Table.Td><Text size="sm" c="dimmed">{rotulo}</Text></Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={600}>{info.parametros[chave]} {unidade}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <div>
            <Text fw={700}>Integridade dos certificados</Text>
            <Text size="sm" c="dimmed" maw={560}>
              Recalcula a assinatura de todos os certificados. Divergência é indício
              forte de alguém ter escrito direto no banco.
            </Text>
          </div>
          <Button leftSection={<IconShieldSearch size={16} />} loading={verificando}
                  disabled={!info.chave.configurada} onClick={verificar}>
            Verificar todos
          </Button>
        </Group>

        {relatorio && (relatorio.divergentes.length === 0 ? (
          <Alert mt="md" color="brand" variant="light" icon={<IconCircleCheck size={18} />}>
            {relatorio.total} certificado(s) conferido(s) em{" "}
            {new Date(relatorio.verificadoEm).toLocaleString("pt-BR")}. Todas as
            assinaturas conferem.
          </Alert>
        ) : (
          <Alert mt="md" color="red" variant="light" icon={<IconAlertOctagon size={18} />}
                 title={`${relatorio.divergentes.length} de ${relatorio.total} não conferem`}>
            <Stack gap={4}>
              {relatorio.divergentes.map((d) => (
                <Group key={d.id} gap="xs">
                  <Badge color="red" variant="light" ff="monospace" tt="none">{d.codigo}</Badge>
                  <Text size="sm">{d.aluno} · {d.atividade}</Text>
                </Group>
              ))}
            </Stack>
          </Alert>
        ))}
      </Card>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <div>
            <Text fw={700}>Manutenção</Text>
            <Text size="sm" c="dimmed" maw={560}>
              Remove sessões e links de senha que já venceram. Sessões revogadas mas
              ainda no prazo ficam: são elas que denunciam o reuso de um token roubado.
            </Text>
          </div>
          <Button variant="light" leftSection={<IconTrash size={16} />}
                  loading={limpando} onClick={limpar}>
            Limpar tokens vencidos
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}
