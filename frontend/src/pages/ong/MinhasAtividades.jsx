import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Badge, Box, Button, Center, Pagination, Stack, Tabs,
} from "@mantine/core";
import {
  IconCalendarPlus, IconClipboardCheck, IconEdit, IconPlus, IconQrcode,
  IconSettings, IconTrash, IconUsersGroup, IconX,
} from "@tabler/icons-react";

import LinhaAtividade from "../../components/atividade/LinhaAtividade";
import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const TAMANHO = 12;

/**
 * As abas de "acontecendo" e "a validar" existem só como situação calculada —
 * o servidor deriva ambas de `publicada` mais o relógio (RN-54).
 */
const ABAS = [
  { valor: "rascunho", rotulo: "Rascunhos" },
  { valor: "publicada", rotulo: "Publicadas" },
  { valor: "em_andamento", rotulo: "Acontecendo" },
  { valor: "aguardando_validacao", rotulo: "A validar" },
  { valor: "finalizada", rotulo: "Finalizadas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

const VAZIO = {
  rascunho: ["Nenhum rascunho", "Ao criar uma atividade, dá para salvar sem publicar."],
  publicada: ["Nenhuma atividade publicada pela frente",
              "Publique uma atividade para ela aparecer na vitrine."],
  em_andamento: ["Nada acontecendo agora",
                 "No horário de uma atividade, ela aparece aqui com o check-in."],
  aguardando_validacao: ["Nenhuma presença para validar",
                         "Quando uma atividade termina, ela espera aqui pela sua validação."],
  finalizada: ["Nenhuma atividade finalizada ainda",
               "Depois de validar as presenças, a atividade fecha e os certificados saem."],
  cancelada: ["Nenhuma atividade cancelada", ""],
};

/** O2 — Minhas atividades. */
export default function MinhasAtividades() {
  const navegar = useNavigate();
  const [parametros, definirParametros] = useSearchParams();

  // A aba vem da URL: é assim que o painel (O1) manda a ONG direto para
  // "Rascunhos" ou "A validar", e é o que faz o endereço poder ser guardado.
  const daUrl = parametros.get("aba");
  const [aba, setAba] = useState(
    ABAS.some((item) => item.valor === daUrl) ? daUrl : "publicada");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({ itens: [], total: 0, paginas: 1 });
  const [resumo, setResumo] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/atividades/minhas", {
        params: { situacao: aba, pagina, tamanho: TAMANHO },
      });
      setResultado(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar suas atividades"));
    } finally {
      setCarregando(false);
    }
  }, [aba, pagina]);

  // Os números do topo vêm do mesmo lugar que o painel (O1): assim as duas
  // telas nunca discordam, e não é preciso pedir uma página por aba só para
  // contar. Falhar aqui não derruba a tela — a lista continua servindo.
  const contar = useCallback(async () => {
    try {
      const { data } = await api.get("/painel/ong");
      setResumo(data);
    } catch {
      setResumo(null);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  useEffect(() => {
    contar();
  }, [contar]);

  function trocarAba(valor) {
    setAba(valor);
    setPagina(1);
    definirParametros(valor === "publicada" ? {} : { aba: valor }, { replace: true });
  }

  async function publicar(atividade) {
    try {
      await api.post(`/atividades/${atividade.id}/publicar`);
      notifySuccess("Atividade publicada. Ela já aparece na vitrine.");
      contar();
      trocarAba("publicada");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível publicar"));
    }
  }

  async function cancelar(atividade, motivo) {
    try {
      await api.post(`/atividades/${atividade.id}/cancelar`, { motivo });
      notifySuccess("Atividade cancelada. Os inscritos foram avisados.");
      contar();
      trocarAba("cancelada");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
    }
  }

  async function excluir(atividade) {
    try {
      await api.delete(`/atividades/${atividade.id}`);
      notifySuccess("Rascunho excluído.");
      contar();
      buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível excluir"));
    }
  }

  /** A ação que faz sentido *naquela* situação — só ela fica visível. */
  function acaoPrincipal(atividade) {
    const { situacao, id } = atividade;
    if (situacao === "rascunho") {
      return { rotulo: "Publicar", variante: "filled",
               aoClicar: () => publicar(atividade) };
    }
    if (situacao === "em_andamento") {
      return { rotulo: "Check-in", variante: "filled", icone: IconQrcode,
               aoClicar: () => navegar(`/ong/atividades/${id}/check-in`) };
    }
    if (situacao === "aguardando_validacao") {
      return { rotulo: "Validar presenças", variante: "filled",
               icone: IconClipboardCheck,
               aoClicar: () => navegar(`/ong/atividades/${id}/presencas`) };
    }
    if (situacao === "cancelada") return null;
    return { rotulo: `Inscrições (${atividade.vagasOcupadas})`,
             icone: IconUsersGroup,
             aoClicar: () => navegar(`/ong/atividades/${id}/inscricoes`) };
  }

  function menu(atividade) {
    const { situacao, id } = atividade;
    const podeEditar = ["rascunho", "publicada"].includes(situacao);
    // Enquanto "Inscrições" for o botão visível, repeti-lo no menu só ocupa
    // espaço; quando não for, ele precisa continuar alcançável.
    const inscricoesNoMenu = ["em_andamento", "aguardando_validacao"].includes(situacao);

    return [
      { rotulo: "Gerenciar atividade", icone: IconSettings,
        aoClicar: () => navegar(`/ong/atividades/${id}`) },
      podeEditar && { rotulo: "Editar", icone: IconEdit,
                      aoClicar: () => navegar(`/ong/atividades/${id}/editar`) },
      inscricoesNoMenu && {
        rotulo: `Inscrições (${atividade.vagasOcupadas})`, icone: IconUsersGroup,
        aoClicar: () => navegar(`/ong/atividades/${id}/inscricoes`),
      },
      situacao === "rascunho" && {
        rotulo: "Excluir rascunho", icone: IconTrash, cor: "red",
        aoClicar: () => setConfirmando({ tipo: "excluir", atividade }),
      },
      situacao === "publicada" && {
        rotulo: "Cancelar atividade", icone: IconX, cor: "red",
        aoClicar: () => setConfirmando({ tipo: "cancelar", atividade }),
      },
    ].filter(Boolean);
  }

  const eExcluir = confirmando?.tipo === "excluir";

  // Contagem ao lado do nome da aba, só onde o painel sabe contar.
  const contagem = resumo ? {
    publicada: resumo.atividadesPublicadas,
    aguardando_validacao: resumo.aguardandoValidacao,
    rascunho: resumo.rascunhos,
  } : {};
  const [tituloVazio, textoVazio] = VAZIO[aba];

  return (
    <>
      <PageHeader
        title="Minhas atividades"
        action={
          <Button leftSection={<IconPlus size={17} />}
                  onClick={() => navegar("/ong/atividades/nova")}>
            Nova atividade
          </Button>
        }
      />

      <Tabs value={aba} onChange={trocarAba} mb="md">
        <Tabs.List className="mh-abas-rolam">
          {ABAS.map((item) => (
            <Tabs.Tab key={item.valor} value={item.valor}
                      rightSection={contagem[item.valor] > 0
                        ? <Badge size="sm" color="gray" className="mh-num">
                            {contagem[item.valor]}
                          </Badge>
                        : null}>
              {item.rotulo}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {carregando ? (
        <Loading label="Carregando atividades…" />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={IconCalendarPlus}
          title={tituloVazio}
          description={textoVazio}
          action={["rascunho", "publicada"].includes(aba) ? {
            label: "Nova atividade",
            onClick: () => navegar("/ong/atividades/nova"),
          } : undefined}
        />
      ) : (
        <Stack gap="md">
          <Box>
            <div className="mh-cabecalho-colunas" aria-hidden="true">
              <span>Data</span><span>Atividade</span><span>Horário</span>
              <span>Horas</span><span>Inscritos</span><span />
            </div>
            <Box className="mh-lista">
            {resultado.itens.map((atividade) => (
              <LinhaAtividade
                key={atividade.id}
                atividade={atividade}
                para={`/ong/atividades/${atividade.id}`}
                comSituacao={false}
                acao={acaoPrincipal(atividade)}
                menu={menu(atividade)}
              />
            ))}
            </Box>
          </Box>

          {resultado.paginas > 1 && (
            <Center>
              <Pagination total={resultado.paginas} value={pagina} onChange={setPagina} />
            </Center>
          )}
        </Stack>
      )}

      <ConfirmarAcao
        aberto={Boolean(confirmando)}
        aoFechar={() => setConfirmando(null)}
        titulo={eExcluir ? "Excluir rascunho" : "Cancelar atividade"}
        mensagem={
          eExcluir
            ? `"${confirmando?.atividade?.titulo}" será apagado definitivamente.`
            : `"${confirmando?.atividade?.titulo}" sai da vitrine e todas as inscrições são encerradas. Não dá para reabrir.`
        }
        rotuloConfirmar={eExcluir ? "Excluir" : "Cancelar atividade"}
        pedirMotivo={!eExcluir}
        aoConfirmar={(motivo) =>
          eExcluir
            ? excluir(confirmando.atividade)
            : cancelar(confirmando.atividade, motivo)
        }
      />
    </>
  );
}
