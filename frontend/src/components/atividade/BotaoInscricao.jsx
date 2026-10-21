import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import {
  IconAlertTriangle, IconCircleCheck, IconHourglassHigh,
} from "@tabler/icons-react";

import ConfirmarAcao from "../ui/ConfirmarAcao";
import { useAuth } from "../../context/AuthContext";
import { cadastroComo } from "../portal/navegacao";
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
/** Uma situação dita em texto, com ícone: não é botão, não finge ser. */
function Estado({ icone: Icone, cor, children }) {
  return (
    <Group gap={6} wrap="nowrap">
      {Icone && <Icone size={17} color={`var(--mantine-color-${cor.replace(".", "-")})`}
                       aria-hidden="true" />}
      <Text size="sm" fw={600} c={cor}>{children}</Text>
    </Group>
  );
}

/**
 * `compacto` é para o rodapé do cartão da vitrine: só a ação principal.
 */
export default function BotaoInscricao({
  atividade, aoMudar, tamanho, largo = false, compacto = false,
}) {
  const navegar = useNavigate();
  const { usuario } = useAuth();
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
    // Visitante, vindo do portal: a inscrição começa pelo cadastro e volta
    // para esta mesma atividade, já dentro da área do estudante.
    if (!usuario) {
      if (atividade.situacao !== "publicada" || atividade.lotada) return null;
      const volta = `/atividades/${atividade.id}`;
      return (
        <Group gap="xs" wrap="wrap">
          <Button {...comum} component={Link} to={cadastroComo("estudante", volta)}>
            Quero participar
          </Button>
          {!compacto && (
            <Button {...comum} variant="default" component={Link}
                    to={`/entrar?volta=${encodeURIComponent(volta)}`}>
              Já tenho conta
            </Button>
          )}
        </Group>
      );
    }
    // ONG e admin olham a vaga, mas não se inscrevem.
    if (usuario.papel !== "estudante") return null;

    // Situação não é botão: botão desabilitado com "Aguardando aprovação"
    // parece algo que deveria dar para clicar. Vira texto, e o botão que
    // sobra é o que a pessoa pode de fato fazer.
    if (inscricao?.situacao === "pendente") {
      return (
        <Group gap="xs" wrap="nowrap">
          <Estado icone={IconHourglassHigh} cor="violet.8">Aguardando a ONG</Estado>
          <Button size="compact-sm" variant="subtle" color="gray"
                  onClick={() => setConfirmando(true)}>
            Cancelar
          </Button>
        </Group>
      );
    }

    if (ativa) {
      const podeCancelar = atividade.situacao === "publicada";
      return (
        <Group gap="xs" wrap="nowrap">
          <Estado icone={IconCircleCheck} cor="green.8">Inscrito</Estado>
          {podeCancelar && (
            <Button size="compact-sm" variant="subtle" color="gray"
                    onClick={() => setConfirmando(true)}>
              Cancelar
            </Button>
          )}
        </Group>
      );
    }

    if (atividade.situacao !== "publicada") {
      return <Estado cor="dimmed">Inscrições encerradas</Estado>;
    }
    if (atividade.lotada) return null;

    return (
      <Button {...comum} loading={enviando} onClick={inscrever}>
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
        mensagem="A vaga volta para a lista e outra pessoa pode ficar com ela."
        rotuloConfirmar="Cancelar inscrição"
        rotuloVoltar="Manter inscrição"
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
