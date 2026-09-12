import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Center, Group, Pagination, SimpleGrid, Stack, Tabs,
} from "@mantine/core";
import {
  IconCalendarPlus, IconEdit, IconPlus, IconSettings, IconTrash, IconX,
} from "@tabler/icons-react";

import CartaoAtividade from "../../components/atividade/CartaoAtividade";
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
  rascunho: "Nenhum rascunho. Crie uma atividade e salve sem publicar.",
  publicada: "Nenhuma atividade publicada aguardando a data.",
  em_andamento: "Nada acontecendo agora.",
  aguardando_validacao: "Nenhuma atividade esperando validação de presença.",
  finalizada: "Nenhuma atividade finalizada ainda.",
  cancelada: "Nenhuma atividade cancelada.",
};

/** O2 — Minhas atividades. */
export default function MinhasAtividades() {
  const navegar = useNavigate();

  const [aba, setAba] = useState("publicada");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({ itens: [], total: 0, paginas: 1 });
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

  useEffect(() => {
    buscar();
  }, [buscar]);

  function trocarAba(valor) {
    setAba(valor);
    setPagina(1);
  }

  async function publicar(atividade) {
    try {
      await api.post(`/atividades/${atividade.id}/publicar`);
      notifySuccess("Atividade publicada. Ela já aparece na vitrine.");
      trocarAba("publicada");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível publicar"));
    }
  }

  async function cancelar(atividade, motivo) {
    try {
      await api.post(`/atividades/${atividade.id}/cancelar`, { motivo });
      notifySuccess("Atividade cancelada e inscrições encerradas.");
      trocarAba("cancelada");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
    }
  }

  async function excluir(atividade) {
    try {
      await api.delete(`/atividades/${atividade.id}`);
      notifySuccess("Rascunho excluído.");
      buscar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível excluir"));
    }
  }

  function botoes(atividade) {
    const { situacao, id } = atividade;
    const podeEditar = ["rascunho", "publicada"].includes(situacao);

    return (
      <Stack gap={6}>
        <Group gap={6} grow>
          {situacao === "rascunho" && (
            <Button size="compact-sm" onClick={() => publicar(atividade)}>
              Publicar
            </Button>
          )}
          {podeEditar && (
            <Button size="compact-sm" variant="light"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => navegar(`/ong/atividades/${id}/editar`)}>
              Editar
            </Button>
          )}
          <Button size="compact-sm" variant="light"
                  leftSection={<IconSettings size={14} />}
                  onClick={() => navegar(`/ong/atividades/${id}`)}>
            Gerenciar
          </Button>
        </Group>

        {situacao === "rascunho" && (
          <Button size="compact-sm" variant="subtle" color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setConfirmando({ tipo: "excluir", atividade })}>
            Excluir rascunho
          </Button>
        )}
        {situacao === "publicada" && (
          <Button size="compact-sm" variant="subtle" color="red"
                  leftSection={<IconX size={14} />}
                  onClick={() => setConfirmando({ tipo: "cancelar", atividade })}>
            Cancelar atividade
          </Button>
        )}
      </Stack>
    );
  }

  const eExcluir = confirmando?.tipo === "excluir";

  return (
    <>
      <PageHeader
        eyebrow="Organização"
        title="Minhas atividades"
        subtitle="Rascunhos, publicações e histórico das atividades que você criou."
        action={
          <Button leftSection={<IconPlus size={17} />}
                  onClick={() => navegar("/ong/atividades/nova")}>
            Nova atividade
          </Button>
        }
      />

      <Tabs value={aba} onChange={trocarAba} mb="lg" variant="outline">
        <Tabs.List>
          {ABAS.map((item) => (
            <Tabs.Tab key={item.valor} value={item.valor}>
              {item.rotulo}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {carregando ? (
        <Loading label="Carregando atividades..." />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={IconCalendarPlus}
          title="Nada nesta aba"
          description={VAZIO[aba]}
          action={{
            label: "Criar atividade",
            onClick: () => navegar("/ong/atividades/nova"),
          }}
        />
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {resultado.itens.map((atividade) => (
              <CartaoAtividade key={atividade.id} atividade={atividade}
                               rodape={botoes(atividade)} />
            ))}
          </SimpleGrid>

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
