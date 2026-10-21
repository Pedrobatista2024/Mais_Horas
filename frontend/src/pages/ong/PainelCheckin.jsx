import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Badge, Box, Button, Grid, Group, Modal, Progress, Stack, Text,
  TextInput, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconMaximize, IconPlayerPause, IconPlayerPlay, IconUserPlus,
  IconWifiOff,
} from "@tabler/icons-react";
import QRCode from "qrcode";

import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { formatRelativo, initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

/** De quanto em quanto tempo a lista de quem chegou é rebuscada. */
const INTERVALO_DA_LISTA = 5000;

/** Quanto tempo "Pausar rotação" congela o código. */
const PAUSA_SEGUNDOS = 60;

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

  // O desenho do QR vai num efeito, e não dentro de buscarToken: o token e a
  // lista são pedidos juntos, e quando o token chegava primeiro a tela ainda
  // estava em "carregando", sem canvas. A biblioteca então desenhava num canvas
  // solto, sem erro nenhum, e o QR só aparecia na rotação seguinte, até 30 s
  // depois.
  useEffect(() => {
    if (!codigo || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, codigo, {
      width: 480, margin: 1, errorCorrectionLevel: "M",
    }).catch(() => setSemRede(true));
  }, [codigo, carregando]);

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

  if (carregando) return <Loading label="Abrindo o painel…" />;

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
    <>
      <PageHeader
        voltar={{ para: `/ong/atividades/${id}`, rotulo: dados?.atividade?.titulo ?? "Atividade" }}
        title="Check-in ao vivo"
        subtitle="Mostre esta tela no local. O código muda sozinho a cada 30 segundos, então a foto do QR não serve para quem não veio."
        action={
          <Button variant="default"
                  onClick={() => navegar(`/ong/atividades/${id}/presencas`)}>
            Encerrar check-in
          </Button>
        }
      />

      {semRede && (
        <Alert color="red" icon={<IconWifiOff size={18} />} mb="lg"
               title="Sem conexão com o servidor">
          O código parou de mudar. Enquanto a conexão não voltar ele não é renovado, e um
          código vencido não registra presença.
        </Alert>
      )}

      <Grid gutter={{ base: "lg", md: 40 }}>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Box className="mh-bloco mh-tela-qr" p={{ base: "lg", sm: "xl" }} ref={telaRef}>
            <Stack align="center" gap="md">
              <canvas ref={canvasRef} aria-label="QR Code de presença" className="mh-qr" />

              {/* Quem está sem câmera digita este código em `E5`. Expor o texto
                  não enfraquece nada: ele vence junto com o QR, nos mesmos 40 s. */}
              <Text ff="monospace" size="sm" c="dimmed" ta="center" translate="no"
                    style={{ wordBreak: "break-all" }} maw={440}>
                {codigo}
              </Text>

              <Stack gap={6} w="100%" maw={440}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed" className="mh-num" aria-live="off">
                    {pausado
                      ? `Pausado por ${Math.ceil((pausadoAte - Date.now()) / 1000)} s`
                      : `Muda em ${restante} s`}
                  </Text>
                  {pausado && <Badge color="orange">Pausado</Badge>}
                </Group>
                <Progress value={(restante / duracao) * 100}
                          color={pausado ? "orange" : "brand"} size="sm"
                          aria-label="Tempo até o próximo código" />
              </Stack>

              <Group gap="xs" wrap="wrap" justify="center">
                <Button variant="default" leftSection={<IconMaximize size={16} />}
                        onClick={telaCheia}>
                  Tela cheia
                </Button>
                <Button
                  variant="default"
                  leftSection={pausado ? <IconPlayerPlay size={16} />
                                       : <IconPlayerPause size={16} />}
                  onClick={() => setPausadoAte(pausado
                    ? 0
                    : Date.now() + PAUSA_SEGUNDOS * 1000)}
                >
                  {pausado ? "Voltar a mudar" : "Pausar por 1 minuto"}
                </Button>
              </Group>

              {pausado && (
                <Text size="sm" c="dimmed" ta="center" maw={420}>
                  Pausado, o mesmo código continua na tela. Use só pelo tempo que alguém
                  precisar para conseguir ler.
                </Text>
              )}
            </Stack>
          </Box>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={2} fz="lg">Quem já chegou</Title>
            <Text fw={600} className="mh-num">
              {dados?.presentes} de {dados?.inscritos}
            </Text>
          </Group>

          {chegaram.length === 0 ? (
            <Text size="sm" c="dimmed" mb="md">
              Ninguém registrou presença ainda. Vire a tela para o público.
            </Text>
          ) : (
            <Box className="mh-lista" mb="md" aria-live="polite">
              {chegaram.map((item) => (
                <Group key={item.inscricaoId} className="mh-linha" justify="space-between"
                       wrap="nowrap" gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Avatar src={resolveImage(item.aluno?.foto)} color="brand"
                            radius="xl" size={32} alt={item.aluno?.nome}>
                      {initials(item.aluno?.nome)}
                    </Avatar>
                    <Text fw={500} truncate>{item.aluno?.nome}</Text>
                    {item.checkinOrigem === "manual" && (
                      <Badge color="gray">Manual</Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                    {formatRelativo(item.checkinEm)}
                  </Text>
                </Group>
              ))}
            </Box>
          )}

          <Button variant="default" leftSection={<IconUserPlus size={16} />}
                  onClick={() => setManual(true)}>
            Registrar alguém sem celular
          </Button>
        </Grid.Col>
      </Grid>

      <Modal opened={manual} onClose={() => setManual(false)}
             title="Registrar presença sem o QR">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Para quem veio sem celular, sem bateria ou sem internet. O registro fica
            marcado como manual, separado do que o QR registrou.
          </Text>

          <TextInput label="Buscar pelo nome" placeholder="Nome…" value={busca}
                     autoComplete="off" data-autofocus
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
                    <Avatar src={resolveImage(item.aluno?.foto)} color="gray" alt=""
                            radius="xl" size={32}>
                      {initials(item.aluno?.nome)}
                    </Avatar>
                    <Text size="sm" truncate>
                      {item.aluno?.nome}
                    </Text>
                  </Group>
                  <Button size="xs" variant="default"
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
    </>
  );
}
