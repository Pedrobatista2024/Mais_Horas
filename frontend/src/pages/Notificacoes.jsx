import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Center, Pagination, SegmentedControl,
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
        ? `${data.marcadas} ${data.marcadas === 1 ? "aviso marcado" : "avisos marcados"} como lido.`
        : "Tudo já estava lido.");
      avisarQueAvisosMudaram();
      buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível marcar os avisos"));
    }
  }

  const naoLidas = resultado.itens.some((a) => !a.lida);

  return (
    <Box maw={760}>
      <PageHeader
        title="Avisos"
        subtitle="Respostas de inscrição, cancelamentos e certificados, do mais recente para o mais antigo."
        action={
          <Button variant="default" leftSection={<IconChecks size={16} />}
                  onClick={marcarTodas} disabled={!naoLidas && filtro === "todas"}>
            Marcar todos como lidos
          </Button>
        }
      />

      <SegmentedControl
        mb="md"
        value={filtro}
        onChange={(valor) => { setFiltro(valor); setPagina(1); }}
        data={[
          { label: "Todos", value: "todas" },
          { label: "Não lidos", value: "nao-lidas" },
        ]}
      />

      {carregando ? (
        <Loading label="Carregando avisos…" />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={IconBellOff}
          title={filtro === "nao-lidas" ? "Nenhum aviso por ler" : "Nenhum aviso ainda"}
          description={filtro === "nao-lidas"
            ? "Você já leu tudo."
            : "Quando uma inscrição for respondida ou um certificado sair, o aviso aparece aqui."}
        />
      ) : (
        <Box className="mh-lista">
          {resultado.itens.map((aviso) => (
            <ItemDeAviso key={aviso.id} aviso={aviso} aoAbrir={abrir} emLista />
          ))}
        </Box>
      )}

      {resultado.paginas > 1 && (
        <Center mt="lg">
          <Pagination total={resultado.paginas} value={pagina} onChange={setPagina} />
        </Center>
      )}
    </Box>
  );
}
