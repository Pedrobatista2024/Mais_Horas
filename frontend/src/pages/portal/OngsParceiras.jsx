import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button, Center, Container, Group, Pagination, SimpleGrid, Stack, Text, TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconBuildingCommunity, IconPlus, IconSearch, IconSearchOff } from "@tabler/icons-react";

import CartaoOng from "../../components/portal/CartaoOng";
import { cadastroComo } from "../../components/portal/navegacao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useListagem } from "../../hooks/useListagem";

const TAMANHO = 12;

/**
 * T5 — ONGs parceiras.
 *
 * Só aparecem organizações ativas que já publicaram alguma atividade: a lista
 * é prova social, e cartão de conta vazia não prova nada.
 */
export default function OngsParceiras() {
  const navegar = useNavigate();
  const { autenticado } = useAuth();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [buscaAdiada] = useDebouncedValue(busca.trim(), 350);

  const params = useMemo(() => ({
    pagina, tamanho: TAMANHO, ...(buscaAdiada ? { busca: buscaAdiada } : {}),
  }), [pagina, buscaAdiada]);
  const { dados, carregando } = useListagem("/portal/ongs", params);

  return (
    <Container size="xl" py={{ base: "lg", md: 40 }}>
      <PageHeader
        eyebrow="ONGs parceiras"
        title="Quem faz acontecer"
        subtitle="Organizações que já publicaram atividades na plataforma. As verificadas pela administração aparecem primeiro."
        action={!autenticado && (
          <Button color="navy" leftSection={<IconPlus size={16} />}
                  component={Link} to={cadastroComo("ong")}>
            Publicar minha ONG aqui
          </Button>
        )}
      />

      <TextInput
        mb="lg" maw={420}
        placeholder="Buscar por nome ou cidade"
        leftSection={<IconSearch size={16} />}
        value={busca}
        onChange={(e) => { setBusca(e.currentTarget.value); setPagina(1); }}
        aria-label="Buscar organizações"
      />

      {carregando ? (
        <Loading label="Carregando organizações..." />
      ) : dados.itens.length === 0 ? (
        <EmptyState
          icon={buscaAdiada ? IconSearchOff : IconBuildingCommunity}
          title={buscaAdiada ? "Nenhuma organização encontrada"
                             : "As primeiras parceiras estão chegando"}
          description={buscaAdiada
            ? "Tente outro nome ou cidade."
            : "Assim que uma organização publicar a primeira atividade, ela aparece aqui."}
          action={buscaAdiada ? { label: "Limpar busca", onClick: () => setBusca("") }
            : !autenticado ? { label: "Cadastrar minha ONG", onClick: () => navegar(cadastroComo("ong")) }
            : undefined}
        />
      ) : (
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            {dados.total} {dados.total === 1 ? "organização" : "organizações"}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {dados.itens.map((ong) => (
              <CartaoOng key={ong.id} ong={ong} aoClicar={() => navegar(`/ongs/${ong.id}`)} />
            ))}
          </SimpleGrid>
          {dados.paginas > 1 && (
            <Group justify="center">
              <Center>
                <Pagination total={dados.paginas} value={pagina} onChange={setPagina} />
              </Center>
            </Group>
          )}
        </Stack>
      )}
    </Container>
  );
}
