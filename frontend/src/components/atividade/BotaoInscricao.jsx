import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconUserPlus, IconUserX } from "@tabler/icons-react";

import ConfirmarAcao from "../ui/ConfirmarAcao";
import { api, codigoDoErro, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

/** Situações em que a inscrição ainda vale — as que dão direito a cancelar. */
const ATIVAS = ["pendente", "confirmada"];

/** Os campos que a RN-45 exige, em texto de gente. */
const ROTULOS = {
  nome_completo: "nome completo",
  instituicao: "instituição",
  curso: "curso",
};

/**
 * O botão de inscrição de `E2` e `E3`.
 *
 * Ele decide o que mostrar a partir do estado que o servidor mandou junto com a
 * atividade — não guarda estado próprio. Depois de agir, chama `aoMudar()` para
 * a tela recarregar: o contador de vagas também muda.
 */
export default function BotaoInscricao({ atividade, aoMudar, tamanho, largo = false }) {
  const navegar = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [perfilIncompleto, setPerfilIncompleto] = useState(null);

  const inscricao = atividade.minhaInscricao;
  const ativa = inscricao && ATIVAS.includes(inscricao.situacao);
  const comum = { size: tamanho, fullWidth: largo };

  async function inscrever() {
    setEnviando(true);
    try {
      const { data } = await api.post("/inscricoes", { atividadeId: atividade.id });
      notifySuccess(
        data.situacao === "pendente"
          ? "Inscrição enviada. A ONG vai avaliar seu pedido."
          : "Inscrição confirmada. Até lá!",
      );
      aoMudar?.();
    } catch (erro) {
      // A RN-45 não é "erro do usuário": é um passo que falta. Em vez de um
      // toast que some, abre o caminho para completar o perfil.
      if (codigoDoErro(erro) === "perfil_incompleto") {
        setPerfilIncompleto(erro.response?.data?.detalhes ?? []);
      } else {
        notifyError(mensagemDoErro(erro, "Não foi possível inscrever"));
        // Vagas esgotadas ou atividade cancelada: a tela está desatualizada.
        aoMudar?.();
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    try {
      await api.post(`/inscricoes/${inscricao.id}/cancelar`);
      notifySuccess("Inscrição cancelada. A vaga foi liberada.");
      aoMudar?.();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível cancelar"));
      aoMudar?.();
    }
  }

  function conteudo() {
    if (inscricao?.situacao === "pendente") {
      return (
        <Stack gap={6}>
          <Button {...comum} variant="light" color="yellow" disabled>
            Aguardando aprovação
          </Button>
          <Button {...comum} variant="subtle" color="red" size="compact-sm"
                  onClick={() => setConfirmando(true)}>
            Cancelar inscrição
          </Button>
        </Stack>
      );
    }

    if (ativa) {
      const podeCancelar = atividade.situacao === "publicada";
      return (
        <Button {...comum} variant="light" color={podeCancelar ? "red" : "gray"}
                leftSection={<IconUserX size={16} />} disabled={!podeCancelar}
                onClick={() => setConfirmando(true)}>
          {podeCancelar ? "Cancelar inscrição" : "Inscrição confirmada"}
        </Button>
      );
    }

    if (atividade.situacao !== "publicada") {
      return <Button {...comum} disabled>Inscrições encerradas</Button>;
    }
    if (atividade.lotada) {
      return <Button {...comum} disabled>Vagas esgotadas</Button>;
    }

    return (
      <Button {...comum} loading={enviando} leftSection={<IconUserPlus size={16} />}
              onClick={inscrever}>
        Inscrever-se
      </Button>
    );
  }

  return (
    <>
      {conteudo()}

      <ConfirmarAcao
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Cancelar inscrição"
        mensagem="Deseja mesmo cancelar? A vaga será liberada para outra pessoa."
        rotuloConfirmar="Cancelar inscrição"
        aoConfirmar={cancelar}
      />

      <Modal
        opened={Boolean(perfilIncompleto)}
        onClose={() => setPerfilIncompleto(null)}
        title="Complete seu perfil"
        centered
        radius="md"
      >
        <Stack gap="md">
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <IconAlertTriangle size={20} color="var(--mantine-color-clay-6)"
                               style={{ flexShrink: 0, marginTop: 2 }} />
            <Text size="sm" c="dimmed">
              É este nome que vai no seu certificado, então precisamos dele antes da
              primeira inscrição.
            </Text>
          </Group>

          {perfilIncompleto?.length > 0 && (
            <Text size="sm">
              Falta preencher:{" "}
              <b>{perfilIncompleto.map((d) => ROTULOS[d.campo] || d.campo).join(", ")}</b>.
            </Text>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setPerfilIncompleto(null)}>
              Agora não
            </Button>
            <Button onClick={() => navegar("/perfil")}>Completar perfil</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
