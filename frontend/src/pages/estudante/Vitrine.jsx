import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button, Center, Chip, Collapse, Group, NumberInput, Pagination, SimpleGrid,
  Stack, Text, TextInput,
} from "@mantine/core";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconAdjustmentsHorizontal, IconSearch, IconSearchOff } from "@tabler/icons-react";

import BotaoInscricao from "../../components/atividade/BotaoInscricao";
import CartaoAtividade from "../../components/atividade/CartaoAtividade";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

const TAMANHO = 12;

/** Lê um número da URL; vazio ou inválido vira "". */
function numero(valor) {
  const n = Number(valor);
  return valor && Number.isFinite(n) ? n : "";
}

/**
 * E2 — Vitrine de atividades (também a vitrine pública, em `/vagas`).
 *
 * Os filtros vão **para o servidor**, não são aplicados sobre uma lista já
 * baixada. E moram na URL: a busca "Fortaleza, só com vaga" pode ser guardada
 * ou mandada no grupo da turma, e o voltar do navegador volta para ela.
 *
 * No celular, só a busca fica à mostra; o resto abre em "Filtros". Antes os
 * quatro campos ocupavam a tela inteira antes da primeira vaga aparecer.
 */
export default function Vitrine({ base = "/atividades", titulo = "Buscar atividades" }) {
  const [params, setParams] = useSearchParams();
  const largo = useMediaQuery("(min-width: 62em)");

  const pagina = Number(params.get("pagina")) || 1;
  const cidade = params.get("cidade") || "";
  const cargaMin = numero(params.get("cargaMin"));
  const cargaMax = numero(params.get("cargaMax"));
  const comVaga = params.get("comVaga") === "1";

  // A busca tem estado próprio enquanto se digita; a URL só muda depois da
  // pausa, senão cada tecla viraria uma requisição e uma entrada no histórico.
  const [busca, setBusca] = useState(params.get("busca") || "");
  const [buscaAdiada] = useDebouncedValue(busca, 350);
  const [cidadeLocal, setCidadeLocal] = useState(cidade);
  const [cidadeAdiada] = useDebouncedValue(cidadeLocal, 350);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({ itens: [], total: 0, paginas: 1 });

  const alterar = useCallback((mudancas) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      Object.entries(mudancas).forEach(([chave, valor]) => {
        if (valor === "" || valor === false || valor === null || valor === undefined) {
          novo.delete(chave);
        } else {
          novo.set(chave, valor === true ? "1" : String(valor));
        }
      });
      if (!("pagina" in mudancas)) novo.delete("pagina");
      return novo;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if ((params.get("busca") || "") !== buscaAdiada.trim()) alterar({ busca: buscaAdiada.trim() });
  }, [buscaAdiada]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cidade !== cidadeAdiada.trim()) alterar({ cidade: cidadeAdiada.trim() });
  }, [cidadeAdiada]); // eslint-disable-line react-hooks/exhaustive-deps

  const consulta = params.toString();

  const buscar = useCallback(async () => {
    setCarregando(true);
    const filtros = Object.fromEntries(new URLSearchParams(consulta));
    if (filtros.comVaga) filtros.comVaga = true;
    try {
      const { data } = await api.get("/atividades", {
        params: { ...filtros, pagina: filtros.pagina || 1, tamanho: TAMANHO },
      });
      setResultado(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar as atividades"));
    } finally {
      setCarregando(false);
    }
  }, [consulta]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const extras = [cidade, cargaMin, cargaMax].filter(Boolean).length;
  const temFiltro = Boolean(busca || extras || comVaga);

  function limpar() {
    setBusca("");
    setCidadeLocal("");
    setParams({}, { replace: true });
  }

  const camposExtras = (
    <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm" style={{ flex: largo ? "0 0 auto" : 1 }}
                w={largo ? 460 : undefined}>
      <TextInput label="Cidade" placeholder="Fortaleza" value={cidadeLocal}
                 onChange={(e) => setCidadeLocal(e.currentTarget.value)} />
      <NumberInput label="Mínimo de horas" placeholder="1" min={1} max={24}
                   value={cargaMin} onChange={(v) => alterar({ cargaMin: v })} />
      <NumberInput label="Máximo de horas" placeholder="8" min={1} max={24}
                   value={cargaMax} onChange={(v) => alterar({ cargaMax: v })} />
    </SimpleGrid>
  );

  return (
    <>
      <PageHeader title={titulo}
                  subtitle="Vagas publicadas pelas organizações, da data mais próxima em diante." />

      <Stack gap="sm" mb="lg">
        <Group align="flex-end" gap="sm" wrap="nowrap">
          <TextInput label="Buscar" placeholder="Título, local ou organização…" type="search"
                     leftSection={<IconSearch size={16} aria-hidden="true" />}
                     value={busca} onChange={(e) => setBusca(e.currentTarget.value)}
                     style={{ flex: 1 }} autoComplete="off" spellCheck={false} />
          {largo ? camposExtras : (
            <Button variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />}
                    onClick={() => setFiltrosAbertos((v) => !v)}
                    aria-expanded={filtrosAbertos}>
              Filtros{extras ? ` (${extras})` : ""}
            </Button>
          )}
        </Group>
        {!largo && <Collapse in={filtrosAbertos}>{camposExtras}</Collapse>}
        <Group gap="sm">
          <Chip checked={comVaga} onChange={(v) => alterar({ comVaga: v })} variant="outline"
                size="sm">
            Só com vaga livre
          </Chip>
          {temFiltro && (
            <Button variant="subtle" size="compact-sm" color="gray" onClick={limpar}>
              Limpar filtros
            </Button>
          )}
        </Group>
      </Stack>

      {carregando ? (
        <Loading label="Buscando atividades…" />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={temFiltro ? IconSearchOff : undefined}
          title={temFiltro ? "Nenhuma atividade com esses filtros"
                           : "Nenhuma vaga aberta no momento"}
          description={temFiltro
            ? "Tente outra palavra ou tire algum filtro."
            : "Assim que uma organização publicar, a vaga aparece aqui."}
          action={temFiltro
            ? { label: "Limpar filtros", onClick: limpar, variante: "default" }
            : undefined}
        />
      ) : (
        <Stack gap="lg">
          <Text size="sm" c="dimmed" aria-live="polite" className="mh-num">
            {resultado.total} {resultado.total === 1 ? "atividade" : "atividades"}
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {resultado.itens.map((atividade) => (
              <CartaoAtividade
                key={atividade.id}
                atividade={atividade}
                para={`${base}/${atividade.id}`}
                rodape={
                  <BotaoInscricao atividade={atividade} aoMudar={buscar} tamanho="xs"
                                  compacto />
                }
              />
            ))}
          </SimpleGrid>

          {resultado.paginas > 1 && (
            <Center>
              <Pagination total={resultado.paginas} value={pagina}
                          onChange={(p) => alterar({ pagina: p })} />
            </Center>
          )}
        </Stack>
      )}
    </>
  );
}
