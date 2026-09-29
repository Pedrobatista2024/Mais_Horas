import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Button, Card, Divider, Group, NumberInput, SimpleGrid, Stack, Switch,
  Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { DatePickerInput, TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconAlertTriangle, IconArrowLeft, IconLock } from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

/** Campos que a RN-12 trava assim que existe alguém inscrito. */
const SO_VAGAS = ["vagas_min", "vagas_max"];

/**
 * Descrição **abaixo** do campo, e não entre o rótulo e ele.
 *
 * Na ordem padrão do Mantine, o campo que tem descrição começa mais embaixo
 * que os vizinhos: na linha "Quando", a carga horária era a única com texto de
 * apoio e ficava desalinhada dos outros três. A explicação da RN-12 faz o
 * mesmo, aparecendo em uns campos e não em outros.
 */
const DESCRICAO_ABAIXO = {
  inputWrapperOrder: ["label", "input", "description", "error"],
};

const VAZIO = {
  titulo: "", descricao: "", local: "", cidade: "", estado: "",
  data: null, hora_inicio: "08:00", hora_fim: "12:00",
  carga_horaria: 4, vagas_min: 1, vagas_max: 20, exige_aprovacao: false,
};

/** "08:00" e "12:00" → 4. Arredonda para baixo, igual ao servidor (RN-48). */
function horasEntre(inicio, fim) {
  const [hi, mi] = String(inicio || "").split(":").map(Number);
  const [hf, mf] = String(fim || "").split(":").map(Number);
  if ([hi, mi, hf, mf].some(Number.isNaN)) return null;
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  return minutos <= 0 ? null : Math.max(1, Math.floor(minutos / 60));
}

/** Date → "aaaa-mm-dd" sem passar por UTC, que voltaria um dia. */
function paraISO(data) {
  if (!data) return null;
  if (typeof data === "string") return data.slice(0, 10);
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function deISO(texto) {
  if (!texto) return null;
  const [ano, mes, dia] = texto.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * O3 — Criar / editar atividade.
 *
 * A mesma tela cria e edita. Com inscritos, os campos travados aparecem
 * desabilitados **com a explicação ao lado**: a versão anterior aceitava a
 * alteração e a descartava em silêncio, o que é pior que recusar.
 */
export default function FormularioAtividade() {
  const { id } = useParams();
  const navegar = useNavigate();
  const editando = Boolean(id);

  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [atividade, setAtividade] = useState(null);
  const [descartando, setDescartando] = useState(false);
  const [cargaManual, setCargaManual] = useState(false);

  const form = useForm({
    initialValues: VAZIO,
    validate: {
      titulo: (v) => (v.trim().length ? null : "Informe um título"),
      descricao: (v) => (v.trim().length ? null : "Descreva a atividade"),
      local: (v) => (v.trim().length ? null : "Informe o local"),
      data: (v) => (v ? null : "Escolha a data"),
      hora_fim: (v, valores) =>
        horasEntre(valores.hora_inicio, v) ? null : "O término deve ser depois do início",
      vagas_max: (v, valores) =>
        v >= valores.vagas_min ? null : "O máximo não pode ser menor que o mínimo",
    },
  });

  useEffect(() => {
    if (!editando) return;
    let ativo = true;
    api
      .get(`/atividades/${id}`)
      .then(({ data }) => {
        if (!ativo) return;
        setAtividade(data);
        setCargaManual(true);
        const valores = {
          titulo: data.titulo, descricao: data.descricao, local: data.local,
          cidade: data.cidade || "", estado: data.estado || "",
          data: deISO(data.data),
          hora_inicio: data.horaInicio, hora_fim: data.horaFim,
          carga_horaria: data.cargaHoraria,
          vagas_min: data.vagasMin, vagas_max: data.vagasMax,
          exige_aprovacao: data.exigeAprovacao,
        };
        form.setValues(valores);
        form.resetDirty(valores);
      })
      .catch((erro) =>
        notifyError(mensagemDoErro(erro, "Não foi possível carregar a atividade")))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A carga segue o horário até a ONG digitar um valor próprio (D18).
  const sugestao = horasEntre(form.values.hora_inicio, form.values.hora_fim);
  useEffect(() => {
    if (!cargaManual && sugestao) form.setFieldValue("carga_horaria", sugestao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestao, cargaManual]);

  const inscritos = atividade?.vagasOcupadas ?? 0;
  const travado = inscritos > 0;
  const encerrada = ["finalizada", "cancelada"].includes(atividade?.situacao);

  const aviso = useMemo(
    () => (travado ? `Não pode ser alterado: já há ${inscritos} pessoa(s) inscrita(s)` : null),
    [travado, inscritos],
  );

  /** `disabled` + explicação, para os campos que a RN-12 congela. */
  function trava(campo) {
    if (!travado || SO_VAGAS.includes(campo)) return {};
    return { disabled: true, description: aviso };
  }

  /** Um campo do formulário: trava da RN-12, ordem da descrição e ligação. */
  function campo(nome) {
    return { ...DESCRICAO_ABAIXO, ...trava(nome), ...form.getInputProps(nome) };
  }

  function corpo(valores) {
    return {
      titulo: valores.titulo.trim(),
      descricao: valores.descricao.trim(),
      local: valores.local.trim(),
      cidade: valores.cidade.trim() || null,
      estado: valores.estado.trim() || null,
      data: paraISO(valores.data),
      hora_inicio: valores.hora_inicio,
      hora_fim: valores.hora_fim,
      carga_horaria: valores.carga_horaria,
      vagas_min: valores.vagas_min,
      vagas_max: valores.vagas_max,
      exige_aprovacao: valores.exige_aprovacao,
    };
  }

  async function salvar(valores, publicarDepois = false) {
    setSalvando(true);
    try {
      let alvo = id;

      if (editando) {
        // Com inscritos, mandar só o que pode mudar evita recusa do servidor
        // por campos que a ONG nem tentou editar.
        const dados = corpo(valores);
        const payload = travado
          ? Object.fromEntries(SO_VAGAS.map((c) => [c, dados[c]]))
          : dados;
        await api.put(`/atividades/${id}`, payload);
      } else {
        const { data } = await api.post("/atividades", corpo(valores));
        alvo = data.id;
      }

      if (publicarDepois) {
        await api.post(`/atividades/${alvo}/publicar`);
        notifySuccess("Atividade publicada. Ela já aparece na vitrine.");
      } else {
        notifySuccess(editando ? "Alterações salvas" : "Rascunho salvo");
      }
      navegar(`/ong/atividades/${alvo}`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível salvar"));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Loading label="Carregando atividade..." />;

  return (
    <Stack gap="lg" maw={1040} mx="auto" w="100%">
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar("/ong/atividades")}>
        Voltar às minhas atividades
      </Button>

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          Organização
        </Text>
        <Title order={1} fz={{ base: 26, sm: 32 }}>
          {editando ? "Editar atividade" : "Nova atividade"}
        </Title>
        <Text c="dimmed" size="sm">
          {editando
            ? "As alterações valem para quem já viu a vaga na vitrine."
            : "Ela nasce como rascunho — só aparece na vitrine depois de publicada."}
        </Text>
      </Stack>

      {encerrada && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
          Atividade {atividade.situacao} não pode mais ser editada.
        </Alert>
      )}

      {travado && !encerrada && (
        <Alert color="clay" variant="light" icon={<IconLock size={18} />}
               title="Edição limitada">
          Já há {inscritos} pessoa(s) inscrita(s). Só o número de vagas pode mudar —
          alterar data, local ou carga mudaria as condições sob as quais elas se
          inscreveram.
        </Alert>
      )}

      <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
        <form onSubmit={form.onSubmit((v) => salvar(v, false))}>
          <Stack gap="md">
            <TextInput label="Título" placeholder="Mutirão de limpeza da praia"
                       withAsterisk maxLength={40}
                       {...campo("titulo")} />

            <Textarea label="Descrição"
                      placeholder="O que será feito, o que levar, o que esperar"
                      withAsterisk minRows={4} autosize maxLength={1500}
                      {...campo("descricao")} />

            <Divider label="Onde" labelPosition="left" />

            <TextInput label="Local" placeholder="Praia do Futuro, posto 6"
                       withAsterisk maxLength={50}
                       {...campo("local")} />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Cidade" placeholder="Fortaleza"
                         {...campo("cidade")} />
              <TextInput label="Estado" placeholder="CE"
                         {...campo("estado")} />
            </SimpleGrid>

            <Divider label="Quando" labelPosition="left" />

            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
              <DatePickerInput
                label="Data" placeholder="Escolha o dia" withAsterisk
                valueFormat="DD/MM/YYYY" minDate={new Date()}
                {...campo("data")}
              />
              <TimeInput label="Início" withAsterisk
                         {...campo("hora_inicio")} />
              <TimeInput label="Término" withAsterisk
                         {...campo("hora_fim")} />
              {/* Fica na mesma linha do horário: é dele que a carga é sugerida. */}
              <NumberInput
                label="Carga horária"
                description={
                  cargaManual
                    ? "Ajuste se houver intervalo que não conta"
                    : `Sugerida pelo horário${sugestao ? `: ${sugestao}h` : ""}`
                }
                min={1} max={24}
                {...campo("carga_horaria")}
                onChange={(v) => {
                  setCargaManual(true);
                  form.setFieldValue("carga_horaria", v);
                }}
              />
            </SimpleGrid>

            <Divider label="Vagas" labelPosition="left" />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput label="Mínimo de participantes" min={1}
                           {...campo("vagas_min")} />
              <NumberInput label="Máximo de vagas" min={1}
                           {...campo("vagas_max")} />
            </SimpleGrid>

            <Switch
              label="Exigir aprovação para cada inscrição"
              description="Ligado, as inscrições ficam pendentes até você aprovar"
              {...trava("exige_aprovacao")}
              {...form.getInputProps("exige_aprovacao", { type: "checkbox" })}
            />

            <Divider my="xs" />

            <Group justify="space-between" wrap="wrap" gap="sm">
              <Button variant="subtle" color="gray"
                      onClick={() => (editando
                        ? navegar(`/ong/atividades/${id}`)
                        : setDescartando(true))}>
                {editando ? "Voltar sem salvar" : "Descartar"}
              </Button>

              <Group gap="sm" wrap="wrap">
                <Button type="submit" variant="light" loading={salvando}
                        disabled={encerrada}>
                  {editando ? "Salvar alterações" : "Salvar rascunho"}
                </Button>
                {(!editando || atividade?.situacao === "rascunho") && (
                  <Button loading={salvando} disabled={encerrada}
                          onClick={() => form.onSubmit((v) => salvar(v, true))()}>
                    Publicar
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>
        </form>
      </Card>

      <ConfirmarAcao
        aberto={descartando}
        aoFechar={() => setDescartando(false)}
        titulo="Descartar atividade"
        mensagem="O que você preencheu será perdido."
        rotuloConfirmar="Descartar"
        aoConfirmar={() => navegar("/ong/atividades")}
      />
    </Stack>
  );
}
