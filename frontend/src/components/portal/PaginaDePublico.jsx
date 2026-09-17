import { Link } from "react-router-dom";
import {
  Accordion, Badge, Box, Button, Container, Group, Paper, SimpleGrid, Stack, Text,
  ThemeIcon, Title,
} from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import ChamadaFinal from "./ChamadaFinal";
import Secao from "./Secao";
import { cadastroComo } from "./navegacao";

/**
 * Esqueleto de T3 (estudantes) e T4 (ONGs): "o que eu ganho com isso",
 * como começar, dúvidas e o cadastro com o perfil já escolhido.
 */
export default function PaginaDePublico({
  papel, cor, eyebrow, titulo, subtitulo, rotuloCadastro, acaoExtra,
  vantagens, passos, duvidas, chamada,
}) {
  const { autenticado } = useAuth();

  return (
    <>
      <Box className="mh-hero">
        <Container size="xl" py={{ base: 48, md: 72 }}>
          <Stack gap="lg" maw={720}>
            <Badge size="lg" radius="sm" color="clay" variant="filled" w="fit-content">
              {eyebrow}
            </Badge>
            <Title className="mh-display" c="white" fz={{ base: 34, sm: 46 }}>{titulo}</Title>
            <Text c="rgba(255,255,255,0.9)" fz={{ base: "md", md: "lg" }}>{subtitulo}</Text>
            <Group gap="md">
              {!autenticado && (
                <Button size="lg" color="clay" component={Link} to={cadastroComo(papel)}
                        rightSection={<IconArrowRight size={18} />}>
                  {rotuloCadastro}
                </Button>
              )}
              {acaoExtra && (
                <Button size="lg" variant="white" color="dark" component={Link}
                        to={acaoExtra.para}>
                  {acaoExtra.rotulo}
                </Button>
              )}
            </Group>
          </Stack>
        </Container>
      </Box>

      <Secao eyebrow="O que você ganha" titulo="Feito para o seu dia a dia">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {vantagens.map(({ icone: Icone, titulo: t, texto }) => (
            <Paper key={t} withBorder radius="lg" p="lg" h="100%">
              <ThemeIcon size={46} radius="md" variant="light" color={cor} mb="md">
                <Icone size={25} />
              </ThemeIcon>
              <Text fw={800} mb={4}>{t}</Text>
              <Text size="sm" c="dimmed">{texto}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Secao>

      <Secao alternada eyebrow="Como começar" titulo="Em poucos minutos">
        <Stack gap="md" maw={720} mx="auto">
          {passos.map((passo, i) => (
            <Paper key={passo.titulo} withBorder radius="lg" p="lg">
              <Group gap="md" wrap="nowrap" align="flex-start">
                <ThemeIcon size={36} radius="xl" color={cor} style={{ flexShrink: 0 }}>
                  <Text fw={800} size="sm">{i + 1}</Text>
                </ThemeIcon>
                <div>
                  <Text fw={800}>{passo.titulo}</Text>
                  <Text size="sm" c="dimmed">{passo.texto}</Text>
                </div>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Secao>

      <Secao eyebrow="Dúvidas" titulo="Perguntas frequentes">
        <Accordion variant="separated" radius="md" maw={760} mx="auto">
          {duvidas.map(({ pergunta, resposta }) => (
            <Accordion.Item key={pergunta} value={pergunta}>
              <Accordion.Control fw={700}>{pergunta}</Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed">{resposta}</Text>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Secao>

      <ChamadaFinal papel={papel} rotulo={rotuloCadastro} {...chamada} />
    </>
  );
}
