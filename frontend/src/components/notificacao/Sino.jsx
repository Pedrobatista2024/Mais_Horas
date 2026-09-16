import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ActionIcon, Button, Divider, Group, Indicator, Loader, Popover, ScrollArea,
  Stack, Text,
} from "@mantine/core";
import { IconBell, IconChecks } from "@tabler/icons-react";

import { api, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";
import { AVISOS_MUDARAM } from "./eventos";
import ItemDeAviso from "./ItemDeAviso";

/** A cada quanto o contador é conferido com a janela aberta. */
const INTERVALO_DO_CONTADOR = 60_000;

/** Quantos avisos cabem no painel; o resto fica em /notificacoes. */
const NO_PAINEL = 6;

/**
 * O sino do cabeçalho (D16, FE-10).
 *
 * O contador é barato e é o que roda sozinho; a lista só é buscada quando o
 * usuário abre o painel. Assim o sino não vira um carregamento pesado a cada
 * minuto em quem nem vai olhar.
 */
export default function Sino() {
  const navegar = useNavigate();
  const local = useLocation();

  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [avisos, setAvisos] = useState(null);

  // O resultado chega por callback: o efeito só dispara a consulta.
  const contar = useCallback(() => {
    api.get("/notificacoes/contador")
      .then(({ data }) => setNaoLidas(data.naoLidas))
      .catch(() => {
        // O sino é acessório: se a consulta falhar, fica como estava.
      });
  }, []);

  // Confere ao montar e a cada troca de tela — é quando o usuário
  // provavelmente vai olhar para o sino.
  useEffect(() => {
    contar();
  }, [contar, local.pathname]);

  useEffect(() => {
    const relogio = setInterval(() => {
      if (document.visibilityState === "visible") contar();
    }, INTERVALO_DO_CONTADOR);
    window.addEventListener("focus", contar);
    window.addEventListener(AVISOS_MUDARAM, contar);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("focus", contar);
      window.removeEventListener(AVISOS_MUDARAM, contar);
    };
  }, [contar]);

  async function abrir() {
    setAberto(true);
    setAvisos(null);
    try {
      const { data } = await api.get("/notificacoes", {
        params: { tamanho: NO_PAINEL },
      });
      setAvisos(data.itens);
    } catch (erro) {
      setAvisos([]);
      notifyError(mensagemDoErro(erro, "Não foi possível carregar os avisos"));
    }
  }

  async function abrirAviso(aviso) {
    setAberto(false);
    if (!aviso.lida) {
      try {
        await api.post(`/notificacoes/${aviso.id}/lida`);
        setNaoLidas((atual) => Math.max(0, atual - 1));
      } catch {
        // Não impede de seguir para o destino.
      }
    }
    // Só caminho interno — o servidor já filtra, e o cliente confere de novo.
    if (aviso.link?.startsWith("/") && !aviso.link.startsWith("//")) {
      navegar(aviso.link);
    }
  }

  async function marcarTodas() {
    try {
      await api.post("/notificacoes/lidas");
      setNaoLidas(0);
      setAvisos((atual) => atual?.map((a) => ({ ...a, lida: true })) ?? atual);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível marcar os avisos"));
    }
  }

  const rotulo = naoLidas > 0
    ? `Avisos: ${naoLidas} não ${naoLidas === 1 ? "lido" : "lidos"}`
    : "Avisos";

  return (
    <Popover opened={aberto} onChange={setAberto} position="bottom-end"
             width={340} shadow="md" radius="md" withinPortal>
      <Popover.Target>
        <Indicator label={naoLidas > 9 ? "9+" : naoLidas} size={18}
                   disabled={naoLidas === 0} color="red" offset={4}>
          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl"
                      aria-label={rotulo}
                      onClick={() => (aberto ? setAberto(false) : abrir())}>
            <IconBell size={21} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p="xs">
        <Group justify="space-between" px="xs" pt={4} pb="xs">
          <Text fw={700} size="sm">Avisos</Text>
          {naoLidas > 0 && (
            <Button variant="subtle" size="compact-xs"
                    leftSection={<IconChecks size={14} />} onClick={marcarTodas}>
              Marcar todas como lidas
            </Button>
          )}
        </Group>
        <Divider />

        {avisos === null ? (
          <Group justify="center" py="lg"><Loader size="sm" /></Group>
        ) : avisos.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            Você não tem avisos no momento.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={360} type="auto">
            <Stack gap={4} py={6}>
              {avisos.map((aviso) => (
                <ItemDeAviso key={aviso.id} aviso={aviso} aoAbrir={abrirAviso} />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}

        <Divider />
        <Button variant="subtle" fullWidth size="compact-sm" mt={6}
                onClick={() => { setAberto(false); navegar("/notificacoes"); }}>
          Ver todos os avisos
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}
