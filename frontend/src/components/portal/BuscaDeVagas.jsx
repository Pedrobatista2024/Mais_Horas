import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Anchor, Box, Button, Text, TextInput, Title } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

/**
 * O cartão que flutua sobre a foto da abertura. Não é enfeite: a busca leva
 * direto para a vitrine já filtrada (`/vagas?busca=…`).
 */
export default function BuscaDeVagas({ total = 0 }) {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");

  function enviar(evento) {
    evento.preventDefault();
    const termo = busca.trim();
    navegar(termo ? `/vagas?busca=${encodeURIComponent(termo)}` : "/vagas");
  }

  return (
    <Box component="form" onSubmit={enviar} className="mh-cartao-flutuante" role="search">
      <Title order={2} className="mh-serif" fz={{ base: 24, md: 28 }}>
        Encontre sua próxima vaga
      </Title>
      <Text c="dimmed" mt={6}>
        {total > 0
          ? `${total} ${total === 1 ? "vaga aberta" : "vagas abertas"} agora, com carga horária e certificado.`
          : "Vagas de ONGs, com carga horária e certificado."}
      </Text>
      <TextInput mt="lg" size="md" label="O que você procura"
                 placeholder="Praia, leitura, reforço escolar…" type="search"
                 leftSection={<IconSearch size={18} aria-hidden="true" />}
                 value={busca} onChange={(e) => setBusca(e.currentTarget.value)}
                 autoComplete="off" />
      <Button type="submit" fullWidth mt="md" className="mh-botao-portal">
        Buscar vagas
      </Button>
      <Text size="sm" c="dimmed" mt="md" ta="center">
        É de uma ONG?{" "}
        <Anchor component={Link} to="/para-ongs" fw={600}>Cadastre sua organização</Anchor>
      </Text>
    </Box>
  );
}
