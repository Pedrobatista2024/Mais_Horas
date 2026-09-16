import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Divider, Group, SimpleGrid, Stack, Text,
  TextInput, ThemeIcon, Title,
} from "@mantine/core";
import {
  IconAlertOctagon, IconAlertTriangle, IconCircleCheck, IconCircleX,
  IconDownload, IconSearch, IconShieldCheck, IconWifiOff,
} from "@tabler/icons-react";

import PublicPage from "../../components/layout/PublicPage";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { baixarArquivo } from "../../utils/baixar";
import { formatDateLong } from "../../utils/format";
import { notifyError } from "../../utils/notify";

/**
 * Aparência de cada desfecho. O **texto** não mora aqui: vem pronto do servidor
 * (RN-56), para a mensagem nunca virar um "erro" genérico montado no cliente.
 */
const APARENCIA = {
  valido: { cor: "brand", icone: IconCircleCheck },
  revogado: { cor: "yellow", icone: IconAlertTriangle },
  adulterado: { cor: "red", icone: IconAlertOctagon },
  inexistente: { cor: "gray", icone: IconSearch },
};

const SELOS = [
  { chave: "existe", rotulo: "Existe na base" },
  { chave: "naoRevogado", rotulo: "Não revogado" },
  { chave: "assinaturaConfere", rotulo: "Assinatura confere" },
];

function Selo({ ok, rotulo }) {
  return (
    <Group gap={8} wrap="nowrap">
      {ok ? <IconCircleCheck size={20} color="var(--mantine-color-brand-6)" />
          : <IconCircleX size={20} color="var(--mantine-color-red-6)" />}
      <Text size="sm" fw={600} c={ok ? undefined : "red.7"}>
        {rotulo}
      </Text>
    </Group>
  );
}

function Dado({ rotulo, children }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {rotulo}
      </Text>
      <Text fw={650}>{children}</Text>
    </div>
  );
}

function CampoDeCodigo({ inicial = "", aoVerificar }) {
  const [codigo, setCodigo] = useState(inicial);
  const limpo = codigo.trim();

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (limpo) aoVerificar(limpo); }}>
      <Stack gap="sm">
        <TextInput
          label="Código do certificado"
          description="16 caracteres, impressos abaixo do QR Code"
          placeholder="a1b2c3d4e5f60718"
          value={codigo}
          maxLength={32}
          ff="monospace"
          onChange={(e) => setCodigo(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" leftSection={<IconSearch size={16} />}
                  disabled={!limpo}>
            Verificar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * T6 — Verificar certificado. **A tela mais importante do sistema.**
 *
 * Quem lê é a coordenação decidindo se aceita uma comprovação de horas. Os
 * dados exibidos vêm da base, não do arquivo que o aluno entregou — e o botão de
 * PDF oficial deixa o verificador parar de depender desse arquivo.
 */
export default function VerificarCertificado() {
  const { codigo } = useParams();
  const navegar = useNavigate();

  const [carregando, setCarregando] = useState(Boolean(codigo));
  const [resposta, setResposta] = useState(null);
  const [semConexao, setSemConexao] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const verificar = useCallback(async () => {
    if (!codigo) return;
    setCarregando(true);
    setSemConexao(false);
    try {
      const { data } = await api.get(
        `/certificados/verificar/${encodeURIComponent(codigo)}`);
      setResposta(data);
    } catch (erro) {
      // O 404 do "inexistente" traz o corpo completo: é desfecho, não falha.
      if (erro?.response?.data?.desfecho) {
        setResposta(erro.response.data);
      } else if (erro?.response?.status === 429) {
        setResposta(null);
        notifyError(mensagemDoErro(erro, "Muitas verificações seguidas"));
      } else {
        // Sem rede não dá para afirmar nada: a revogação só se sabe na fonte.
        setResposta(null);
        setSemConexao(true);
      }
    } finally {
      setCarregando(false);
    }
  }, [codigo]);

  useEffect(() => {
    verificar();
  }, [verificar]);

  async function baixarOficial() {
    setBaixando(true);
    try {
      await baixarArquivo(
        `/certificados/verificar/${encodeURIComponent(resposta.certificado.codigo)}/pdf`,
        `certificado-${resposta.certificado.codigo}.pdf`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível baixar o PDF oficial"));
    } finally {
      setBaixando(false);
    }
  }

  function irPara(novo) {
    navegar(`/verificar/${encodeURIComponent(novo)}`);
  }

  let conteudo;

  if (!codigo) {
    conteudo = (
      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <CampoDeCodigo aoVerificar={irPara} />
      </Card>
    );
  } else if (carregando) {
    conteudo = <Loading label="Conferindo na base da Mais Horas..." />;
  } else if (semConexao) {
    conteudo = (
      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <Stack align="center" gap="md" py="md">
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            <IconWifiOff size={32} />
          </ThemeIcon>
          <Title order={3} ta="center">Não foi possível verificar agora</Title>
          <Text c="dimmed" ta="center" maw={440}>
            A verificação precisa consultar a base da Mais Horas — é só lá que se
            sabe se um certificado foi revogado. Confira sua conexão e tente de novo.
          </Text>
          <Button onClick={verificar}>Tentar de novo</Button>
        </Stack>
      </Card>
    );
  } else if (resposta) {
    const { cor, icone: Icone } = APARENCIA[resposta.desfecho] ?? APARENCIA.inexistente;
    const cert = resposta.certificado;

    conteudo = (
      <Stack gap="lg">
        <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}
              style={{ borderTop: `4px solid var(--mantine-color-${cor}-6)` }}>
          <Stack gap="md">
            <Group gap="md" wrap="nowrap" align="flex-start">
              <ThemeIcon size={56} radius="xl" variant="light" color={cor}
                         style={{ flexShrink: 0 }}>
                <Icone size={30} />
              </ThemeIcon>
              <Stack gap={6}>
                <Title order={2} fz={{ base: 22, sm: 26 }} lh={1.2}>
                  {resposta.titulo}
                </Title>
                <Text>{resposta.mensagem}</Text>
              </Stack>
            </Group>

            {resposta.desfecho === "adulterado" && (
              <Alert color="red" variant="filled" icon={<IconAlertOctagon size={20} />}>
                Não aceite este documento como comprovação de horas.
              </Alert>
            )}

            {resposta.desfecho !== "inexistente" && (
              <>
                <Divider />
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  {SELOS.map((selo) => (
                    <Selo key={selo.chave} rotulo={selo.rotulo}
                          ok={resposta.selos[selo.chave]} />
                  ))}
                </SimpleGrid>
              </>
            )}
          </Stack>
        </Card>

        {cert && (
          <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
            <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
              <Text fw={700}>Dados registrados na Mais Horas</Text>
              <Badge variant="light" color="gray" ff="monospace" tt="none">
                {cert.codigo}
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Dado rotulo="Participante">{cert.aluno}</Dado>
              <Dado rotulo="Organização">{cert.organizacao}</Dado>
              <Dado rotulo="Atividade">{cert.atividade}</Dado>
              <Dado rotulo="Carga horária">
                {cert.horas} {cert.horas === 1 ? "hora" : "horas"}
              </Dado>
              <Dado rotulo="Data da atividade">
                {formatDateLong(cert.dataAtividade)}
              </Dado>
              <Dado rotulo="Emitido em">
                {new Date(cert.emitidoEm).toLocaleString("pt-BR", {
                  dateStyle: "long", timeStyle: "short",
                })}
              </Dado>
            </SimpleGrid>

            {resposta.desfecho === "valido" && (
              <>
                <Divider my="lg" />
                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Text size="sm" c="dimmed" maw={420}>
                    Prefira o PDF baixado daqui ao arquivo que você recebeu: ele sai
                    direto da fonte.
                  </Text>
                  <Button leftSection={<IconDownload size={16} />} loading={baixando}
                          onClick={baixarOficial}>
                    Baixar PDF oficial
                  </Button>
                </Group>
              </>
            )}
          </Card>
        )}

        <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
          <Text fw={700} mb="sm">Verificar outro código</Text>
          <CampoDeCodigo key={codigo} aoVerificar={irPara} />
        </Card>
      </Stack>
    );
  }

  return (
    <PublicPage maxWidth="md">
      <Stack gap="lg">
        <Stack gap={4}>
          <Group gap={6}>
            <IconShieldCheck size={16} color="var(--mantine-color-brand-7)" />
            <Text tt="uppercase" c="brand.7" fw={700} size="xs">
              Verificação de certificado
            </Text>
          </Group>
          <Text c="dimmed" size="sm">
            Confere o certificado direto na base da Mais Horas e checa a assinatura
            digital de cada um. Não é preciso ter conta.
          </Text>
        </Stack>
        {conteudo}
      </Stack>
    </PublicPage>
  );
}
