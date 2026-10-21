import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import {
  IconAlertOctagon, IconAlertTriangle, IconCircleCheck, IconCircleX,
  IconDownload, IconSearch, IconWifiOff,
} from "@tabler/icons-react";

import ProvaIndependente from "../../components/certificado/ProvaIndependente";
import PublicPage from "../../components/layout/PublicPage";
import Horas from "../../components/ui/Horas";
import Loading from "../../components/ui/Loading";
import { useTitulo } from "../../hooks/useTitulo";
import { api, mensagemDoErro } from "../../services/api";
import { baixarArquivo } from "../../utils/baixar";
import { formatDateLong } from "../../utils/format";
import { notifyError } from "../../utils/notify";

/**
 * Aparência de cada desfecho. O **texto** não mora aqui: vem pronto do servidor
 * (RN-56), para a mensagem nunca virar um "erro" genérico montado no cliente.
 */
const APARENCIA = {
  valido: { cor: "green", icone: IconCircleCheck },
  revogado: { cor: "orange", icone: IconAlertTriangle },
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
      {ok ? <IconCircleCheck size={20} color="var(--mantine-color-green-7)" aria-label="sim" />
          : <IconCircleX size={20} color="var(--mantine-color-red-7)" aria-label="não" />}
      <Text size="sm" fw={500} c={ok ? undefined : "red.8"}>
        {rotulo}
      </Text>
    </Group>
  );
}

function Dado({ rotulo, children }) {
  return (
    <Box>
      <Text size="sm" c="dimmed">{rotulo}</Text>
      <Text fw={500} component="div">{children}</Text>
    </Box>
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
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
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
  useTitulo("Verificação de certificado");

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
      <Box className="mh-bloco" p={{ base: "lg", sm: "xl" }}>
        <CampoDeCodigo aoVerificar={irPara} />
      </Box>
    );
  } else if (carregando) {
    conteudo = <Loading label="Conferindo na base da Mais Horas…" />;
  } else if (semConexao) {
    conteudo = (
      <Box className="mh-bloco" p={{ base: "lg", sm: "xl" }}>
        <Stack align="center" gap="md" py="md">
          <IconWifiOff size={32} color="var(--mh-tinta-3)" aria-hidden="true" />
          <Title order={2} fz="xl" ta="center">Não foi possível verificar agora</Title>
          <Text c="dimmed" ta="center" maw={440}>
            A verificação precisa consultar a base da Mais Horas, porque só lá se sabe se
            um certificado foi revogado. Confira a conexão e tente de novo.
          </Text>
          <Button onClick={verificar}>Tentar de novo</Button>
        </Stack>
      </Box>
    );
  } else if (resposta) {
    const { cor, icone: Icone } = APARENCIA[resposta.desfecho] ?? APARENCIA.inexistente;
    const cert = resposta.certificado;

    conteudo = (
      <Stack gap="lg">
        <Box className="mh-bloco" p={{ base: "lg", sm: "xl" }} role="status"
             style={{ borderTop: `4px solid var(--mantine-color-${cor}-7)` }}>
          <Stack gap="md">
            <Group gap="md" wrap="nowrap" align="flex-start">
              <ThemeIcon size={48} radius="xl" variant="light" color={cor}
                         style={{ flexShrink: 0 }}>
                <Icone size={28} />
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
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" pt="md"
                          style={{ borderTop: "1px solid var(--mh-linha)" }}>
                {SELOS.map((selo) => (
                  <Selo key={selo.chave} rotulo={selo.rotulo}
                        ok={resposta.selos[selo.chave]} />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Box>

        {cert && (
          <Box className="mh-bloco" p={{ base: "lg", sm: "xl" }}>
            <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
              <Title order={2} fz="lg">Dados registrados na Mais Horas</Title>
              <Text ff="monospace" size="sm" c="dimmed" translate="no">{cert.codigo}</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="lg">
              <Dado rotulo="Participante">{cert.aluno}</Dado>
              <Dado rotulo="Organização">{cert.organizacao}</Dado>
              <Dado rotulo="Atividade">{cert.atividade}</Dado>
              <Dado rotulo="Carga horária">
                <Horas valor={cert.horas} sufixo={cert.horas === 1 ? "hora" : "horas"}
                       style={{ fontSize: "0.9375rem" }} />
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
              <Group justify="space-between" wrap="wrap" gap="sm" mt="lg" pt="lg"
                     style={{ borderTop: "1px solid var(--mh-linha)" }}>
                <Text size="sm" c="dimmed" maw={420}>
                  Prefira o PDF baixado daqui ao arquivo que você recebeu: ele sai direto
                  da fonte.
                </Text>
                <Button leftSection={<IconDownload size={16} />} loading={baixando}
                        onClick={baixarOficial}>
                  Baixar PDF oficial
                </Button>
              </Group>
            )}
          </Box>
        )}

        {cert && <ProvaIndependente codigo={cert.codigo} />}

        <Box className="mh-bloco" p={{ base: "lg", sm: "xl" }}>
          <Title order={2} fz="lg" mb="sm">Verificar outro código</Title>
          <CampoDeCodigo key={codigo} aoVerificar={irPara} />
        </Box>
      </Stack>
    );
  }

  return (
    <PublicPage>
      <Box mb="xl">
        <Title order={1} fz={{ base: 26, sm: 30 }}>Verificação de certificado</Title>
        <Text c="dimmed" mt={6} maw={600}>
          Confere o certificado direto na base da Mais Horas e checa a assinatura digital.
          Não é preciso ter conta.
        </Text>
      </Box>
      {conteudo}
    </PublicPage>
  );
}
