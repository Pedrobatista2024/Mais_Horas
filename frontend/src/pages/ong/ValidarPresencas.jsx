import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Group, SegmentedControl, Stack, Text,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Horas from "../../components/ui/Horas";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

function horaDoCheckin(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

function Pessoa({ item, decisao, aoDecidir, travado }) {
  const hora = horaDoCheckin(item.checkinEm);
  const manual = item.checkinOrigem === "manual";

  return (
    <Group className="mh-linha" justify="space-between" wrap="wrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: "1 1 260px" }}>
        <Avatar src={resolveImage(item.aluno?.foto)} color="brand" radius="xl" size={36}
                alt={item.aluno?.nome}>
          {initials(item.aluno?.nome)}
        </Avatar>
        <Box style={{ minWidth: 0 }}>
          <Text fw={600} truncate>{item.aluno?.nome}</Text>
          <Text size="sm" c="dimmed">
            {hora
              ? `Check-in às ${hora}${manual ? ", registrado à mão" : " pelo QR"}`
              : "Sem check-in"}
          </Text>
        </Box>
      </Group>

      <SegmentedControl
        size="sm"
        disabled={travado}
        value={decisao ?? ""}
        onChange={(valor) => aoDecidir(item.inscricaoId, valor)}
        aria-label={`Presença de ${item.aluno?.nome}`}
        color={decisao === "ausente" ? "gray" : "brand"}
        data={[
          { label: "Presente", value: "presente" },
          { label: "Ausente", value: "ausente" },
        ]}
      />
    </Group>
  );
}

/**
 * O7 — Validar presenças.
 *
 * Chega pré-preenchida com o que o QR registrou, mas quem decide é a ONG: o
 * check-in é evidência, não veredito (RN-23). Discordar é legítimo — quem foi
 * embora cedo tem check-in e pode ser marcado ausente — e a divergência fica
 * registrada na trilha.
 */
export default function ValidarPresencas() {
  const { id } = useParams();
  const navegar = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);
  const [decisoes, setDecisoes] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const buscar = useCallback(async () => {
    try {
      const { data } = await api.get(`/atividades/${id}/presencas`);
      setDados(data);
      // Quem já foi decidido mantém a decisão; o resto herda a sugestão do
      // servidor, que é quem sabe o que o QR registrou.
      setDecisoes(Object.fromEntries(data.itens.map((i) => [
        i.inscricaoId, i.decidida ? i.situacao : i.sugestao,
      ])));
    } catch (erro) {
      setDados(null);
      if (erro?.response?.status !== 404) {
        notifyError(mensagemDoErro(erro, "Não foi possível carregar a lista"));
      }
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  function decidir(inscricaoId, situacao) {
    setDecisoes((atual) => ({ ...atual, [inscricaoId]: situacao }));
  }

  function marcarTodos(situacao, apenasSemCheckin = false) {
    setDecisoes((atual) => {
      const novo = { ...atual };
      for (const item of dados.itens) {
        if (apenasSemCheckin && item.checkinEm) continue;
        if (!apenasSemCheckin && !item.checkinEm) continue;
        novo[item.inscricaoId] = situacao;
      }
      return novo;
    });
  }

  async function salvar({ avisar = true } = {}) {
    setSalvando(true);
    try {
      await api.put(`/atividades/${id}/presencas`, {
        decisoes: Object.entries(decisoes)
          .filter(([, situacao]) => situacao)
          .map(([inscricaoId, situacao]) => ({ inscricaoId, situacao })),
      });
      if (avisar) notifySuccess("Presenças salvas. Você pode voltar depois.");
      return true;
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível salvar"));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function finalizar() {
    // Grava as decisões antes de fechar: o servidor recusa finalizar com alguém
    // sem definição (RN-03), e é exatamente o que o usuário acabou de resolver.
    if (!(await salvar({ avisar: false }))) return;
    try {
      const { data } = await api.post(`/atividades/${id}/finalizar`);
      notifySuccess(
        `Atividade finalizada: ${plural(data.certificadosEmitidos, "certificado emitido",
                                        "certificados emitidos")}, ` +
        `${plural(data.ausentes, "ausente", "ausentes")}.`,
      );
      navegar(`/ong/atividades/${id}`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível finalizar"));
      buscar();
    }
  }

  if (carregando) return <Loading label="Carregando presenças…" />;

  if (!dados) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title="Lista indisponível"
        description="A atividade pode não estar na fase de validação, ou o endereço está errado."
        action={{ label: "Voltar à atividade",
                  onClick: () => navegar(`/ong/atividades/${id}`) }}
      />
    );
  }

  const encerrada = dados.atividade.situacao === "finalizada";
  const semDecisao = dados.itens.filter((i) => !decisoes[i.inscricaoId]).length;
  const presentes = Object.values(decisoes).filter((s) => s === "presente").length;
  const comCheckin = dados.comCheckin;

  return (
    <>
      <PageHeader
        voltar={{ para: `/ong/atividades/${id}`, rotulo: dados.atividade.titulo }}
        title="Validar presenças"
        subtitle="O check-in vem marcado como sugestão. Quem decide é você: quem saiu cedo, por exemplo, pode ser marcado ausente mesmo com check-in."
      >
        <Group gap="md" mt="sm">
          <Text size="sm" className="mh-num">
            {comCheckin} de {dados.itens.length} fizeram check-in
          </Text>
          <Group gap={6}>
            <Text size="sm" c="dimmed">Cada presença vale</Text>
            <Horas valor={dados.atividade.cargaHoraria} />
          </Group>
        </Group>
      </PageHeader>

      {encerrada && (
        <Alert color="gray" mb="lg">
          Esta atividade já foi finalizada. As presenças não mudam mais.
        </Alert>
      )}

      {dados.itens.length === 0 ? (
        <EmptyState
          title="Ninguém se inscreveu nesta atividade"
          description="Dá para finalizar assim mesmo; nenhum certificado é emitido."
          action={!encerrada ? { label: "Finalizar atividade",
                                 onClick: () => setConfirmando(true) } : undefined}
        />
      ) : (
        <Stack gap="md">
          {!encerrada && (
            <Group gap="xs" wrap="wrap">
              <Button size="xs" variant="default" disabled={comCheckin === 0}
                      onClick={() => marcarTodos("presente")}>
                Quem fez check-in: presente
              </Button>
              <Button size="xs" variant="default"
                      onClick={() => marcarTodos("ausente", true)}>
                Quem não fez: ausente
              </Button>
            </Group>
          )}

          <Box className="mh-lista">
            {dados.itens.map((item) => (
              <Pessoa key={item.inscricaoId} item={item}
                      decisao={decisoes[item.inscricaoId]}
                      aoDecidir={decidir} travado={encerrada} />
            ))}
          </Box>

          {!encerrada && (
            <Box className="mh-bloco" p="md">
              <Stack gap="sm">
                <Text fw={600} className="mh-num">
                  {plural(presentes, "presente", "presentes")} de {dados.itens.length}
                </Text>

                {semDecisao > 0 && (
                  <Alert color="orange" icon={<IconAlertTriangle size={18} />} p="sm">
                    Falta decidir {plural(semDecisao, "pessoa", "pessoas")}. Quem fica sem
                    decisão não recebe certificado nem fica sabendo que faltou.
                  </Alert>
                )}

                <Group justify="flex-end" wrap="wrap" gap="sm">
                  <Button variant="default" loading={salvando} onClick={() => salvar()}>
                    Salvar e terminar depois
                  </Button>
                  <Button disabled={semDecisao > 0} loading={salvando}
                          onClick={() => setConfirmando(true)}>
                    Finalizar e emitir certificados
                  </Button>
                </Group>
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      <ConfirmarAcao
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Finalizar atividade"
        mensagem={presentes > 0
          ? `Saem ${plural(presentes, "certificado", "certificados")} de ${dados.atividade.cargaHoraria} h, assinados digitalmente. Depois disso as presenças não mudam mais.`
          : "Nenhum certificado sai, porque ninguém está marcado como presente. Depois disso as presenças não mudam mais."}
        rotuloConfirmar="Finalizar"
        cor="brand"
        aoConfirmar={finalizar}
      />
    </>
  );
}
