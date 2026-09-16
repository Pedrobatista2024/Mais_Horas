import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Card, Center, Group, Pagination, SegmentedControl, Stack,
} from "@mantine/core";
import { IconBellOff, IconChecks } from "@tabler/icons-react";

import { avisarQueAvisosMudaram } from "../components/notificacao/eventos";
import ItemDeAviso from "../components/notificacao/ItemDeAviso";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";
import PageHeader from "../components/ui/PageHeader";
import { api, mensagemDoErro } from "../services/api";
import { notifyError, notifySuccess } from "../utils/notify";

const TAMANHO = 20;

/** FE-10 — todos os avisos, para quem não achou o que queria no sino. */
export default function Notificacoes() {
  const navegar = useNavigate();

  const [filtro, setFiltro] = useState("todas");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({ itens: [], total: 0, paginas: 1 });

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/notificacoes", {
        params: { pagina, tamanho: TAMANHO,
                  apenasNaoLidas: filtro === "nao-lidas" },
      });
      setResultado(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar os avisos"));
    } finally {
      setCarregando(false);
    }
  }, [pagina, filtro]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  async function abrir(aviso) {
    if (!aviso.lida) {
      try {
        await api.post(`/notificacoes/${aviso.id}/lida`);
        avisarQueAvisosMudaram();
      } catch {
        // Segue para o destino mesmo assim.
      }
    }
    if (aviso.link?.startsWith("/") && !aviso.link.startsWith("//")) {
      navegar(aviso.link);
    } else {
      // Aviso sem destino (A3): marca como lido e fica na tela.
      buscar();
    }
  }

  async function marcarTodas() {
    try {
      const { data } = await api.post("/notificacoes/lidas");
      notifySuccess(data.marcadas
        ? `${data.marcadas} aviso(s) marcado(s) como lido(s).`
        : "Nada a marcar — tudo já estava lido.");
      avisarQueAvisosMudaram();
      buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível marcar os avisos"));
    }
  }

  const naoLidas = resultado.itens.some((a) => !a.lida);

  return (
    <Stack gap="lg" maw={760}>
      <PageHeader
        eyebrow="Avisos"
        title="Notificações"
        subtitle="Aprovações, cancelamentos e certificados, em ordem do mais recente."
        action={
          <Button variant="light" leftSection={<IconChecks size={16} />}
                  onClick={marcarTodas} disabled={!naoLidas && filtro === "todas"}>
            Marcar todas como lidas
          </Button>
        }
      />

      <Group>
        <SegmentedControl
          value={filtro}
          onChange={(valor) => { setFiltro(valor); setPagina(1); }}
          data={[
            { label: "Todas", value: "todas" },
            { label: "Não lidas", value: "nao-lidas" },
          ]}
        />
      </Group>

      {carregando ? (
        <Loading label="Carregando avisos..." />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={IconBellOff}
          title="Você não tem avisos no momento"
          description={filtro === "nao-lidas"
            ? "Tudo lido por aqui."
            : "Quando uma inscrição for respondida ou um certificado sair, o aviso aparece aqui."}
        />
      ) : (
        <Card withBorder radius="md" p="xs">
          <Stack gap={4}>
            {resultado.itens.map((aviso) => (
              <ItemDeAviso key={aviso.id} aviso={aviso} aoAbrir={abrir} />
            ))}
          </Stack>
        </Card>
      )}

      {resultado.paginas > 1 && (
        <Center>
          <Pagination total={resultado.paginas} value={pagina} onChange={setPagina} />
        </Center>
      )}
    </Stack>
  );
}
