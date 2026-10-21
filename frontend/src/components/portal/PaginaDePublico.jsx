import { Link } from "react-router-dom";
import {
  Accordion, Box, Button, Container, Group, SimpleGrid, Stack, Text, Title,
} from "@mantine/core";

import { useAuth } from "../../context/AuthContext";
import { useTitulo } from "../../hooks/useTitulo";
import ChamadaFinal from "./ChamadaFinal";
import Secao from "./Secao";
import { cadastroComo, LARGURA_DO_PORTAL } from "./navegacao";

/**
 * Esqueleto de T3 (estudantes) e T4 (ONGs): o que muda para quem usa, como
 * começar, dúvidas e o cadastro com o perfil já escolhido.
 *
 * O topo é branco, e não outra faixa azul: o azul fica para a página inicial,
 * e cada página de público abre direto no que interessa a ela.
 */
export default function PaginaDePublico({
  papel, titulo, subtitulo, rotuloCadastro, acaoExtra, vantagens, passos, duvidas,
  chamada, tituloDaAba,
}) {
  const { autenticado } = useAuth();
  useTitulo(tituloDaAba);

  return (
    <>
      <Box component="section" className="mh-secao"
           style={{ borderBottom: "1px solid var(--mh-linha)" }}>
        <Container size={LARGURA_DO_PORTAL}>
          <Stack gap="lg" maw={760}>
            <Title order={1} className="mh-display" fz={{ base: 34, sm: 46 }}>
              {titulo}
            </Title>
            <Text c="dimmed" fz={{ base: "md", md: "xl" }} maw={640}>{subtitulo}</Text>
            <Group gap="sm">
              {!autenticado && (
                <Button size="md" component={Link} to={cadastroComo(papel)}>
                  {rotuloCadastro}
                </Button>
              )}
              {acaoExtra && (
                <Button size="md" variant="default" component={Link} to={acaoExtra.para}>
                  {acaoExtra.rotulo}
                </Button>
              )}
            </Group>
          </Stack>
        </Container>
      </Box>

      <Secao titulo="O que muda para você">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={32} verticalSpacing={36}>
          {vantagens.map(({ icone: Icone, titulo: t, texto }) => (
            <Box key={t}>
              <Icone size={22} stroke={1.6} color="var(--mh-royal)" aria-hidden="true" />
              <Text fw={600} fz="lg" mt="xs" mb={4}>{t}</Text>
              <Text c="dimmed">{texto}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Secao>

      <Secao nevoa titulo="Como começar">
        <Box component="ol" p={0} m={0} maw={760} style={{ listStyle: "none" }}>
          {passos.map((passo, i) => (
            <Group key={passo.titulo} component="li" gap="lg" wrap="nowrap" align="flex-start"
                   py="md" style={{ borderTop: i ? "1px solid var(--mh-linha-forte)" : 0 }}>
              <Text className="mh-passo-numero" w={36} fz={28} aria-hidden="true">
                {i + 1}
              </Text>
              <Box>
                <Text fw={600} fz="lg">{passo.titulo}</Text>
                <Text c="dimmed">{passo.texto}</Text>
              </Box>
            </Group>
          ))}
        </Box>
      </Secao>

      <Secao titulo="Perguntas frequentes">
        <Accordion maw={760} chevronPosition="right">
          {duvidas.map(({ pergunta, resposta }) => (
            <Accordion.Item key={pergunta} value={pergunta}>
              <Accordion.Control><Text fw={500}>{pergunta}</Text></Accordion.Control>
              <Accordion.Panel>
                <Text c="dimmed">{resposta}</Text>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Secao>

      <ChamadaFinal papel={papel} rotulo={rotuloCadastro} {...chamada} />
    </>
  );
}
