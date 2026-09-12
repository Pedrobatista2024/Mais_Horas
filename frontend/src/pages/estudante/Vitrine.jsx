import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Card, Center, Group, NumberInput, Pagination, SimpleGrid, Stack,
  Switch, Text, TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconFilterOff, IconSearch, IconSearchOff } from "@tabler/icons-react";

import BotaoInscricao from "../../components/atividade/BotaoInscricao";
import CartaoAtividade from "../../components/atividade/CartaoAtividade";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

const TAMANHO = 12;

const FILTROS_LIMPOS = { busca: "", cidade: "", cargaMin: "", cargaMax: "", comVaga: false };

/**
 * E2 — Vitrine de atividades.
 *
 * Os filtros vão **para o servidor**, não são aplicados sobre uma lista já
 * baixada: com o catálogo crescendo, filtrar no navegador significaria baixar
 * tudo a cada visita.
 */
export default function Vitrine() {
  const navegar = useNavigate();

  const [filtros, setFiltros] = useState(FILTROS_LIMPOS);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState({ itens: [], total: 0, paginas: 1 });

  // Sem isso, cada tecla digitada viraria uma requisição.
  const [buscaAdiada] = useDebouncedValue(filtros.busca, 350);
  const [cidadeAdiada] = useDebouncedValue(filtros.cidade, 350);

  function alterar(campo, valor) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    setPagina(1);
  }

  const buscar = useCallback(async () => {
    setCarregando(true);
    const params = { pagina, tamanho: TAMANHO };
    if (buscaAdiada.trim()) params.busca = buscaAdiada.trim();
    if (cidadeAdiada.trim()) params.cidade = cidadeAdiada.trim();
    if (filtros.cargaMin) params.cargaMin = filtros.cargaMin;
    if (filtros.cargaMax) params.cargaMax = filtros.cargaMax;
    if (filtros.comVaga) params.comVaga = true;

    try {
      const { data } = await api.get("/atividades", { params });
      setResultado(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar as atividades"));
    } finally {
      setCarregando(false);
    }
  }, [pagina, buscaAdiada, cidadeAdiada, filtros.cargaMin, filtros.cargaMax,
      filtros.comVaga]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const temFiltro =
    Boolean(filtros.busca || filtros.cidade || filtros.cargaMin || filtros.cargaMax ||
            filtros.comVaga);

  function limpar() {
    setFiltros(FILTROS_LIMPOS);
    setPagina(1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Atividades"
        title="Encontre uma vaga"
        subtitle="Atividades publicadas por organizações, da data mais próxima em diante."
      />

      <Card withBorder radius="md" p={{ base: "md", sm: "lg" }} mb="lg">
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <TextInput
              label="Buscar"
              placeholder="Título, local ou cidade"
              leftSection={<IconSearch size={16} />}
              value={filtros.busca}
              onChange={(e) => alterar("busca", e.currentTarget.value)}
            />
            <TextInput
              label="Cidade"
              placeholder="Fortaleza"
              value={filtros.cidade}
              onChange={(e) => alterar("cidade", e.currentTarget.value)}
            />
            <NumberInput
              label="Carga mínima"
              placeholder="h"
              min={1}
              max={24}
              value={filtros.cargaMin}
              onChange={(v) => alterar("cargaMin", v)}
            />
            <NumberInput
              label="Carga máxima"
              placeholder="h"
              min={1}
              max={24}
              value={filtros.cargaMax}
              onChange={(v) => alterar("cargaMax", v)}
            />
          </SimpleGrid>

          <Group justify="space-between" wrap="wrap" gap="sm">
            <Switch
              label="Apenas com vaga"
              description="As lotadas continuam na lista quando desligado"
              checked={filtros.comVaga}
              onChange={(e) => alterar("comVaga", e.currentTarget.checked)}
            />
            {temFiltro && (
              <Button variant="subtle" size="compact-sm"
                      leftSection={<IconFilterOff size={15} />} onClick={limpar}>
                Limpar filtros
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      {carregando ? (
        <Loading label="Buscando atividades..." />
      ) : resultado.itens.length === 0 ? (
        <EmptyState
          icon={temFiltro ? IconSearchOff : undefined}
          title={temFiltro ? "Nenhuma atividade com esses filtros"
                           : "Nenhuma atividade disponível no momento"}
          description={temFiltro
            ? "Tente ampliar a busca ou limpar os filtros."
            : "Assim que uma organização publicar, a vaga aparece aqui."}
          action={temFiltro ? { label: "Limpar filtros", onClick: limpar } : undefined}
        />
      ) : (
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            {resultado.total} {resultado.total === 1 ? "atividade" : "atividades"}
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {resultado.itens.map((atividade) => (
              <CartaoAtividade
                key={atividade.id}
                atividade={atividade}
                aoClicar={() => navegar(`/atividades/${atividade.id}`)}
                rodape={
                  <Stack gap={6} onClick={(e) => e.stopPropagation()}>
                    <BotaoInscricao atividade={atividade} aoMudar={buscar}
                                    tamanho="compact-sm" largo />
                    <Button variant="subtle" size="compact-sm" fullWidth
                            onClick={() => navegar(`/atividades/${atividade.id}`)}>
                      Ver detalhes
                    </Button>
                  </Stack>
                }
              />
            ))}
          </SimpleGrid>

          {resultado.paginas > 1 && (
            <Center>
              <Pagination total={resultado.paginas} value={pagina} onChange={setPagina} />
            </Center>
          )}
        </Stack>
      )}
    </>
  );
}
