import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Badge, Button, Card, Group, Modal, Progress, Stack, Text,
  TextInput, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconMaximize, IconPlayerPause,
  IconPlayerPlay, IconUserPlus, IconWifiOff,
} from "@tabler/icons-react";
import QRCode from "qrcode";

import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

/** De quanto em quanto tempo a lista de quem chegou é rebuscada. */
const INTERVALO_DA_LISTA = 5000;

/** Quanto tempo "Pausar rotação" congela o código. */
const PAUSA_SEGUNDOS = 60;

function comoAgora(iso) {
  if (!iso) return "";
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos === 1) return "há 1 min";
  if (minutos < 60) return `há ${minutos} min`;
  return `há ${Math.floor(minutos / 60)} h`;
}

/**
 * O6 — Painel de check-in.
 *
 * É a tela que a ONG projeta no local. O código **roda sozinho**: é isso que
 * impede a foto no WhatsApp de servir para quem não foi, porque quando ela
 * chega o código já venceu.
 *
 * Quando a rede cai, o QR **para de rodar e a tela avisa** — sem servidor não
 * há código novo, e mostrar um vencido em silêncio faria a fila toda falhar
 * sem ninguém entender por quê.
 */
export default function PainelCheckin() {
  const { id } = useParams();
  const navegar = useNavigate();

  const telaRef = useRef(null);
  const canvasRef = useRef(null);

  const [carregando, setCarregando] = useState(true);
  const [erroFatal, setErroFatal] = useState(null);
  const [dados, setDados] = useState(null);
  const [restante, setRestante] = useState(0);
  const [codigo, setCodigo] = useState("");
  const [duracao, setDuracao] = useState(30);
  const [semRede, setSemRede] = useState(false);
  const [pausadoAte, setPausadoAte] = useState(0);
  const [manual, setManual] = useState(false);
  const [busca, setBusca] = useState("");

  const pausado = pausadoAte > Date.now();

  const buscarToken = useCallback(async () => {
    try {
      const { data } = await api.get(`/atividades/${id}/checkin/token`);
      await QRCode.toCanvas(canvasRef.current, data.token, {
        width: 320, margin: 1, errorCorrectionLevel: "M",
      });
      setCodigo(data.token);
      setRestante(data.validoPor);
      setDuracao((atual) => Math.max(atual, data.validoPor));
      setSemRede(false);
    } catch (erro) {
      if (erro?.response?.status === 403) {
        setErroFatal(mensagemDoErro(erro, "O check-in não está aberto"));
      } else {
        // Sem servidor não há código novo. Avisar é melhor que exibir um velho.
        setSemRede(true);
      }
    }
  }, [id]);

  const buscarLista = useCallback(async () => {
    try {
      const { data } = await api.get(`/atividades/${id}/checkin/painel`);
      setDados(data);
      setSemRede(false);
    } catch (erro) {
      if (erro?.response?.status === 403 || erro?.response?.status === 404) {
        setErroFatal(mensagemDoErro(erro, "Não foi possível abrir o painel"));
      } else {
        setSemRede(true);
      }
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    buscarLista();
    buscarToken();
  }, [buscarLista, buscarToken]);

  // Lista ao vivo.
  useEffect(() => {
    if (erroFatal) return undefined;
    const relogio = setInterval(buscarLista, INTERVALO_DA_LISTA);
    return () => clearInterval(relogio);
  }, [buscarLista, erroFatal]);

  // Contagem regressiva; ao zerar, busca o código seguinte.
  useEffect(() => {
    if (erroFatal) return undefined;
    const relogio = setInterval(() => {
      setRestante((atual) => {
        if (atual > 1) return atual - 1;
        if (pausadoAte > Date.now()) return atual;
        buscarToken();
        return 0;
      });
    }, 1000);
    return () => clearInterval(relogio);
  }, [buscarToken, erroFatal, pausadoAte]);

  async function registrarManual(inscricaoId, nome) {
    try {
      await api.post(`/atividades/${id}/checkin/manual`, { inscricaoId });
      notifySuccess(`Presença de ${nome} registrada manualmente.`);
      setBusca("");
      await buscarLista();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível registrar"));
      await buscarLista();
    }
  }

  function telaCheia() {
    const alvo = telaRef.current;
    if (!alvo) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else alvo.requestFullscreen?.();
  }

  if (carregando) return <Loading label="Abrindo o painel..." />;

  if (erroFatal) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title="Check-in indisponível"
        description={erroFatal}
        action={{ label: "Voltar à atividade",
                  onClick: () => navegar(`/ong/atividades/${id}`) }}
      />
    );
  }

  const pendentes = (dados?.itens ?? []).filter((i) => !i.checkinEm);
  const chegaram = (dados?.itens ?? []).filter((i) => i.checkinEm);
  const filtrados = pendentes.filter((i) =>
    i.aluno?.nome?.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <Stack gap="lg" maw={900}>
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar(`/ong/atividades/${id}`)}>
        Voltar à atividade
      </Button>

      <Stack gap={4}>
        <Text tt="uppercase" c="brand.7" fw={700} size="xs">
          Check-in ao vivo
        </Text>
        <Title order={1} fz={{ base: 24, sm: 30 }} lh={1.15}>
          {dados?.atividade?.titulo}
        </Title>
      </Stack>

      {semRede && (
        <Alert color="clay" variant="light" icon={<IconWifiOff size={18} />}
               title="Sem conexão com o servidor">
          O código parou de rodar. Enquanto a conexão não voltar, ele não pode ser
          renovado — e um código vencido não registra presença.
        </Alert>
      )}

      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }} ref={telaRef}
            bg="white">
        <Stack align="center" gap="md">
          <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto" }} />

          {/* Quem está sem câmera digita este código em `E5`. Expor o texto não
              enfraquece nada: ele vence junto com o QR, nos mesmos 40 s. */}
          <Text ff="monospace" size="sm" c="dimmed" ta="center"
                style={{ wordBreak: "break-all" }} maw={320}>
            {codigo}
          </Text>

          <Stack gap={6} w="100%" maw={320}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {pausado
                  ? `Pausado por ${Math.ceil((pausadoAte - Date.now()) / 1000)}s`
                  : `Renova em ${restante}s`}
              </Text>
              <Badge color={pausado ? "clay" : "brand"} variant="light" radius="sm">
                {pausado ? "Congelado" : "Rodando"}
              </Badge>
            </Group>
            <Progress value={(restante / duracao) * 100}
                      color={pausado ? "clay" : "brand"} size="sm" />
          </Stack>

          <Group gap="sm" wrap="wrap" justify="center">
            <Button variant="light" leftSection={<IconMaximize size={16} />}
                    onClick={telaCheia}>
              Tela cheia
            </Button>
            <Button
              variant="light"
              leftSection={pausado ? <IconPlayerPlay size={16} />
                                   : <IconPlayerPause size={16} />}
              onClick={() => setPausadoAte(pausado
                ? 0
                : Date.now() + PAUSA_SEGUNDOS * 1000)}
            >
              {pausado ? "Retomar rotação" : "Pausar rotação"}
            </Button>
            <Button variant="light" leftSection={<IconUserPlus size={16} />}
                    onClick={() => setManual(true)}>
              Adicionar manualmente
            </Button>
          </Group>

          {pausado && (
            <Text size="xs" c="dimmed" ta="center" maw={420}>
              Enquanto pausado, o mesmo código continua na tela. Use só o tempo
              necessário para quem está com dificuldade de leitura.
            </Text>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <Group justify="space-between" wrap="wrap" gap="sm" mb="sm">
          <Text fw={700}>Quem já chegou</Text>
          <Badge color="brand" variant="light" radius="sm" size="lg">
            {dados?.presentes} de {dados?.inscritos}
          </Badge>
        </Group>

        {chegaram.length === 0 ? (
          <Text size="sm" c="dimmed">
            Ninguém registrou presença ainda. Aponte a tela para o público.
          </Text>
        ) : (
          <Stack gap="xs">
            {chegaram.map((item) => (
              <Group key={item.inscricaoId} justify="space-between" wrap="nowrap"
                     gap="sm">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Avatar src={resolveImage(item.aluno?.foto)} color="brand"
                          radius="xl" size={34}>
                    {initials(item.aluno?.nome)}
                  </Avatar>
                  <Text fw={600} truncate>
                    {item.aluno?.nome}
                  </Text>
                  {item.checkinOrigem === "manual" && (
                    <Badge size="xs" color="clay" variant="light">
                      manual
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                  {comoAgora(item.checkinEm)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <Group justify="flex-end">
        <Button variant="light"
                onClick={() => navegar(`/ong/atividades/${id}/presencas`)}>
          Encerrar check-in
        </Button>
      </Group>

      <Modal opened={manual} onClose={() => setManual(false)} centered radius="md"
             title="Registrar presença manualmente">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Para quem veio sem celular, sem bateria ou sem internet. A entrada fica
            marcada como manual, separada do que o QR registrou.
          </Text>

          <TextInput placeholder="Buscar pelo nome" value={busca}
                     onChange={(e) => setBusca(e.currentTarget.value)} />

          {filtrados.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              {pendentes.length === 0
                ? "Todos os inscritos já registraram presença."
                : "Ninguém com esse nome entre quem falta."}
            </Text>
          ) : (
            <Stack gap={6} mah={320} style={{ overflowY: "auto" }}>
              {filtrados.map((item) => (
                <Group key={item.inscricaoId} justify="space-between" wrap="nowrap"
                       gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Avatar src={resolveImage(item.aluno?.foto)} color="gray"
                            radius="xl" size={32}>
                      {initials(item.aluno?.nome)}
                    </Avatar>
                    <Text size="sm" truncate>
                      {item.aluno?.nome}
                    </Text>
                  </Group>
                  <Button size="compact-xs" variant="light"
                          onClick={() => registrarManual(item.inscricaoId,
                                                         item.aluno?.nome)}>
                    Registrar
                  </Button>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
