import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Center, Group, Stack, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconCamera, IconCameraOff, IconCheck,
  IconClockExclamation, IconKeyboard, IconRefresh,
} from "@tabler/icons-react";
import jsQR from "jsqr";

import PageHeader from "../../components/ui/PageHeader";
import { api, codigoDoErro, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

/**
 * Quanto o check-in espera pela localização antes de seguir sem ela. O QR vale
 * 30 s (mais 10 de folga), então esperar muito aqui faria o código vencer.
 */
const LIMITE_DA_LOCALIZACAO = 4000;

/**
 * Resultados que a tela trata de formas diferentes.
 *
 * Código vencido **não é erro do aluno**: o QR roda a cada 30 segundos, então
 * vencer é o caso comum. A mensagem precisa convidar a tentar de novo, não
 * parecer falha.
 */
const DESFECHOS = {
  token_expirado: {
    icone: IconClockExclamation, cor: "orange", titulo: "Este código já venceu",
    texto: "É normal: o código da tela muda a cada 30 segundos. Aponte a câmera de novo.",
    repetir: true,
  },
  token_invalido: {
    icone: IconAlertTriangle, cor: "red", titulo: "Código inválido",
    texto: "Não reconhecemos este código. Confira se é o QR da atividade.",
    repetir: true,
  },
  checkin_ja_registrado: {
    icone: IconCheck, cor: "green", titulo: "Você já registrou presença",
    texto: "Está tudo certo: sua presença nesta atividade já foi registrada.",
    repetir: false,
  },
  sem_inscricao_confirmada: {
    icone: IconAlertTriangle, cor: "red", titulo: "Este código é de outra atividade",
    texto: "Você não tem inscrição confirmada na atividade deste código.",
    repetir: false,
  },
  checkin_fora_da_janela: {
    icone: IconClockExclamation, cor: "orange", titulo: "O check-in não está aberto",
    texto: "Ele só funciona durante o horário da atividade.",
    repetir: false,
  },
};

/** E5 — Check-in por QR. */
export default function Checkin() {
  const navegar = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fluxoRef = useRef(null);
  const lendoRef = useRef(false);

  const [estadoCamera, setEstadoCamera] = useState("iniciando");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [digitando, setDigitando] = useState(false);
  const [codigo, setCodigo] = useState("");

  const pararCamera = useCallback(() => {
    lendoRef.current = false;
    fluxoRef.current?.getTracks()?.forEach((faixa) => faixa.stop());
    fluxoRef.current = null;
  }, []);

  const enviar = useCallback(async (token) => {
    if (enviando) return;
    setEnviando(true);
    pararCamera();

    let posicao = null;
    try {
      // A coordenada é camada extra, nunca a defesa principal: GPS de celular
      // se falsifica. Se o aluno negar, o check-in segue sem ela.
      posicao = await new Promise((ok) => {
        if (!navigator.geolocation) return ok(null);
        // O `timeout` da API só começa a contar depois que a pessoa responde
        // o aviso de permissão. Com o aviso ignorado, a promessa nunca
        // resolvia: a tela girava para sempre e o código do QR vencia na
        // espera. Este relógio é nosso e corre desde já.
        const desistir = setTimeout(() => ok(null), LIMITE_DA_LOCALIZACAO);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(desistir); ok(p); },
          () => { clearTimeout(desistir); ok(null); },
          { timeout: LIMITE_DA_LOCALIZACAO, maximumAge: 60_000 });
      });
    } catch {
      posicao = null;
    }

    try {
      const { data } = await api.post("/checkin", {
        token,
        latitude: posicao?.coords?.latitude ?? null,
        longitude: posicao?.coords?.longitude ?? null,
      });
      setResultado({
        sucesso: true,
        titulo: "Presença registrada",
        texto: data.atividade?.titulo,
        horario: new Date(data.checkinEm).toLocaleTimeString("pt-BR", {
          hour: "2-digit", minute: "2-digit",
        }),
      });
    } catch (erro) {
      const desfecho = DESFECHOS[codigoDoErro(erro)];
      setResultado(desfecho
        ? { ...desfecho, sucesso: false }
        : { sucesso: false, icone: IconAlertTriangle, cor: "red",
            titulo: "Não deu para registrar",
            texto: mensagemDoErro(erro, "Tente de novo em instantes."),
            repetir: true });
    } finally {
      setEnviando(false);
    }
  }, [enviando, pararCamera]);

  const abrirCamera = useCallback(async () => {
    setResultado(null);
    setEstadoCamera("iniciando");
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      fluxoRef.current = fluxo;
      if (videoRef.current) {
        videoRef.current.srcObject = fluxo;
        await videoRef.current.play();
      }
      setEstadoCamera("lendo");
      lendoRef.current = true;
      procurar();
    } catch {
      // Sem câmera ou permissão negada: o campo manual é a saída, não o fim.
      setEstadoCamera("indisponivel");
      setDigitando(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function procurar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!lendoRef.current || !video || !canvas) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const contexto = canvas.getContext("2d", { willReadFrequently: true });
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
      const achado = jsQR(imagem.data, imagem.width, imagem.height, {
        inversionAttempts: "dontInvert",
      });
      if (achado?.data) {
        enviar(achado.data);
        return;
      }
    }
    requestAnimationFrame(procurar);
  }

  useEffect(() => {
    abrirCamera();
    return pararCamera;
  }, [abrirCamera, pararCamera]);

  function enviarDigitado(evento) {
    evento.preventDefault();
    const limpo = codigo.trim();
    if (!limpo) {
      notifyError("Digite o código que aparece abaixo do QR");
      return;
    }
    enviar(limpo);
  }

  function tentarDeNovo() {
    setCodigo("");
    setResultado(null);
    if (estadoCamera === "indisponivel") setDigitando(true);
    else abrirCamera();
  }

  if (resultado) {
    const Icone = resultado.sucesso ? IconCheck : resultado.icone;
    const cor = resultado.sucesso ? "green" : resultado.cor;

    return (
      <Center mih={420}>
        <Stack align="center" gap="lg" maw={420} w="100%" role="status" aria-live="polite">
          <ThemeIcon variant="light" color={cor} size={72} radius="xl">
            <Icone size={38} stroke={1.75} />
          </ThemeIcon>

          <Stack align="center" gap={6}>
            <Title order={1} ta="center" fz={24}>
              {resultado.titulo}
            </Title>
            <Text c="dimmed" ta="center">
              {resultado.texto}
            </Text>
            {resultado.horario && (
              <Text fw={600} size="lg" className="mh-num">
                às {resultado.horario}
              </Text>
            )}
          </Stack>

          <Stack gap="sm" w="100%">
            {!resultado.sucesso && resultado.repetir && (
              <Button fullWidth leftSection={<IconRefresh size={17} />}
                      onClick={tentarDeNovo}>
                Tentar de novo
              </Button>
            )}
            <Button fullWidth variant={resultado.sucesso ? "filled" : "default"}
                    onClick={() => navegar("/minhas-inscricoes")}>
              Ver minhas inscrições
            </Button>
          </Stack>
        </Stack>
      </Center>
    );
  }

  return (
    <Box maw={520}>
      <PageHeader
        voltar={{ para: "/minhas-inscricoes", rotulo: "Minhas inscrições" }}
        title="Fazer check-in"
        subtitle="Aponte a câmera para o QR Code que a organização está mostrando no local."
      />

      <Stack gap="md">
        {estadoCamera === "indisponivel" && (
          <Alert color="gray" icon={<IconCameraOff size={18} />} title="Sem acesso à câmera">
            O navegador não abriu a câmera. Digite abaixo o código que aparece embaixo do
            QR, na tela da organização.
          </Alert>
        )}

        <Box className="mh-bloco" style={{ overflow: "hidden" }}>
          <div style={{ position: "relative", background: "#111a2e", aspectRatio: "1 / 1" }}>
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label="Imagem da câmera"
              style={{ width: "100%", height: "100%", objectFit: "cover",
                       display: estadoCamera === "lendo" ? "block" : "none" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {estadoCamera !== "lendo" && (
              <Center h="100%">
                <Stack align="center" gap="xs">
                  {estadoCamera === "iniciando"
                    ? <IconCamera size={30} color="#9aa7c4" aria-hidden="true" />
                    : <IconCameraOff size={30} color="#9aa7c4" aria-hidden="true" />}
                  <Text size="sm" c="#c7d0e2">
                    {estadoCamera === "iniciando" ? "Abrindo a câmera…" : "Câmera indisponível"}
                  </Text>
                </Stack>
              </Center>
            )}

            {estadoCamera === "lendo" && (
              <div style={{
                position: "absolute", inset: "18%",
                border: "3px solid rgba(255,255,255,.85)", borderRadius: 16,
                pointerEvents: "none",
              }} />
            )}
          </div>
        </Box>

        {enviando && (
          <Text size="sm" c="dimmed" ta="center" role="status">
            Registrando presença…
          </Text>
        )}

        {digitando ? (
          <Box className="mh-bloco" p="lg">
            <form onSubmit={enviarDigitado}>
              <Stack gap="sm">
                <TextInput
                  label="Código da atividade"
                  description="Fica embaixo do QR, na tela da organização"
                  placeholder="MH1.…"
                  value={codigo}
                  onChange={(e) => setCodigo(e.currentTarget.value)}
                  styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <Group justify="flex-end" gap="sm">
                  {estadoCamera !== "indisponivel" && (
                    <Button variant="default" onClick={() => setDigitando(false)}>
                      Usar a câmera
                    </Button>
                  )}
                  <Button type="submit" loading={enviando}>
                    Registrar presença
                  </Button>
                </Group>
              </Stack>
            </form>
          </Box>
        ) : (
          <Button variant="subtle" color="gray" leftSection={<IconKeyboard size={16} />}
                  onClick={() => setDigitando(true)}>
            Sem câmera? Digitar o código
          </Button>
        )}
      </Stack>
    </Box>
  );
}
