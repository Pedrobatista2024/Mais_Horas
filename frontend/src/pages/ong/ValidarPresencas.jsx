import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Badge, Button, Card, Divider, Group, SegmentedControl, Stack,
  Text, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconArrowLeft, IconCircleCheck, IconQrcode, IconUserCheck,
} from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

function horaDoCheckin(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
}

function Pessoa({ item, decisao, aoDecidir, travado }) {
  const hora = horaDoCheckin(item.checkinEm);

  return (
    <Group justify="space-between" wrap="wrap" gap="sm" py="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Avatar src={resolveImage(item.aluno?.foto)} color="brand" radius="xl"
                size={40}>
          {initials(item.aluno?.nome)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Text fw={650} truncate>
            {item.aluno?.nome}
          </Text>
          <Group gap={6} wrap="nowrap">
            {hora ? (
              <>
                <Badge size="xs" variant="light"
                       color={item.checkinOrigem === "manual" ? "clay" : "brand"}
                       leftSection={item.checkinOrigem === "manual"
                         ? <IconUserCheck size={10} />
                         : <IconQrcode size={10} />}>
                  {item.checkinOrigem === "manual" ? "manual" : "QR"}
                </Badge>
                <Text size="xs" c="dimmed">
                  check-in às {hora}
                </Text>
              </>
            ) : (
              <Text size="xs" c="dimmed">
                não registrou check-in
              </Text>
            )}
          </Group>
        </div>
      </Group>

      <SegmentedControl
        size="xs"
        disabled={travado}
        value={decisao ?? ""}
        onChange={(valor) => aoDecidir(item.inscricaoId, valor)}
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
        `Atividade finalizada: ${data.certificadosEmitidos} certificado(s) ` +
        `emitido(s), ${data.ausentes} ausente(s).`,
      );
      navegar(`/ong/atividades/${id}`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível finalizar"));
      buscar();
    }
  }

  if (carregando) return <Loading label="Carregando presenças..." />;

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
    <Stack gap="lg" maw={880}>
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar(`/ong/atividades/${id}`)}>
        Voltar à atividade
      </Button>

      <Stack gap={4}>
        <Text tt="uppercase" c="brand.7" fw={700} size="xs">
          Validar presenças
        </Text>
        <Title order={1} fz={{ base: 24, sm: 30 }} lh={1.15}>
          {dados.atividade.titulo}
        </Title>
        <Text c="dimmed" size="sm">
          {comCheckin} de {dados.itens.length} registraram check-in ·{" "}
          {dados.atividade.cargaHoraria}h por participante
        </Text>
      </Stack>

      {encerrada && (
        <Alert color="gray" variant="light">
          Esta atividade já foi finalizada — as presenças não mudam mais.
        </Alert>
      )}

      {dados.itens.length === 0 ? (
        <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
          <Stack gap="md">
            <Text>
              Ninguém chegou a se inscrever nesta atividade. Você pode encerrá-la
              assim mesmo.
            </Text>
            {!encerrada && (
              <Group justify="flex-end">
                <Button onClick={() => setConfirmando(true)}>
                  Finalizar atividade
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      ) : (
        <>
          {!encerrada && (
            <Group gap="sm" wrap="wrap">
              <Button size="compact-sm" variant="light" disabled={comCheckin === 0}
                      onClick={() => marcarTodos("presente")}>
                Marcar todos os check-ins como presentes
              </Button>
              <Button size="compact-sm" variant="light"
                      onClick={() => marcarTodos("ausente", true)}>
                Marcar os sem check-in como ausentes
              </Button>
            </Group>
          )}

          <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
            <Stack gap={0}>
              {dados.itens.map((item, indice) => (
                <div key={item.inscricaoId}>
                  {indice > 0 && <Divider />}
                  <Pessoa item={item} decisao={decisoes[item.inscricaoId]}
                          aoDecidir={decidir} travado={encerrada} />
                </div>
              ))}
            </Stack>
          </Card>

          {!encerrada && (
            <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
              <Stack gap="md">
                <Group gap="xs">
                  <IconCircleCheck size={19} opacity={0.6} />
                  <Text fw={650}>
                    {presentes} presente(s) de {dados.itens.length}
                  </Text>
                </Group>

                {semDecisao > 0 && (
                  <Alert color="clay" variant="light"
                         icon={<IconAlertTriangle size={18} />}>
                    {semDecisao} participante(s) ainda sem definição. Decida por
                    todos antes de finalizar — quem fica sem decisão não recebe
                    certificado nem fica sabendo que faltou.
                  </Alert>
                )}

                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Button variant="subtle" loading={salvando}
                          onClick={() => salvar()}>
                    Voltar depois
                  </Button>
                  <Button disabled={semDecisao > 0} loading={salvando}
                          onClick={() => setConfirmando(true)}>
                    Confirmar e emitir certificados
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
        </>
      )}

      <ConfirmarAcao
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Finalizar atividade"
        mensagem={`Serão emitidos ${presentes} certificado(s) de ${dados.atividade.cargaHoraria} hora(s), assinados digitalmente. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Finalizar"
        cor="brand"
        aoConfirmar={finalizar}
      />
    </Stack>
  );
}
