import { Link } from "react-router-dom";
import { Box, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { useAuth } from "../../context/AuthContext";
import { useTitulo } from "../../hooks/useTitulo";
import AberturaComFoto from "./AberturaComFoto";
import ChamadaFinal from "./ChamadaFinal";
import PerguntasFrequentes from "./PerguntasFrequentes";
import Secao from "./Secao";
import { cadastroComo } from "./navegacao";

/**
 * Esqueleto de T3 (estudantes) e T4 (ONGs): abertura com foto, o que muda para
 * quem usa, como começar, dúvidas e o fechamento com o cadastro já no perfil
 * certo. As seções alternam azul-claro e branco, como a página inicial.
 */
export default function PaginaDePublico({
  papel, titulo, subtitulo, rotuloCadastro, acaoExtra, vantagens, passos, duvidas,
  chamada, tituloDaAba, foto, altFoto, posicaoFoto,
}) {
  const { autenticado } = useAuth();
  useTitulo(tituloDaAba);

  return (
    <>
      <AberturaComFoto foto={foto} alt={altFoto} posicao={posicaoFoto} baixa>
        <Stack gap="lg" maw={640}>
          <Title order={1} className="mh-serif" c="white" fz={{ base: 36, sm: 48, lg: 56 }}>
            {titulo}
          </Title>
          <Text c="rgba(255,255,255,0.88)" fz={{ base: "md", md: "xl" }} maw={560}>
            {subtitulo}
          </Text>
          <Group gap="sm">
            {!autenticado && (
              <Button variant="white" component={Link} to={cadastroComo(papel)}
                      className="mh-botao-portal">
                {rotuloCadastro}
              </Button>
            )}
            {acaoExtra && (
              <Button variant="outline" color="#ffffff" component={Link} to={acaoExtra.para}
                      className="mh-botao-portal">
                {acaoExtra.rotulo}
              </Button>
            )}
          </Group>
        </Stack>
      </AberturaComFoto>

      <Secao fundo="azul" titulo="O que muda para você">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" className="mh-desliza">
          {vantagens.map(({ icone: Icone, titulo: t, texto }) => (
            <Box key={t} className="mh-recurso">
              <span className="mh-recurso-icone"><Icone size={22} stroke={1.75} /></span>
              <Text fw={600} fz="lg" mt="md">{t}</Text>
              <Text c="dimmed" mt={6}>{texto}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Secao>

      <Secao titulo="Como começar">
        <Box component="ol" p={0} m={0} maw={820} style={{ listStyle: "none" }}>
          {passos.map((passo, i) => (
            <Group key={passo.titulo} component="li" gap="xl" wrap="nowrap" align="flex-start"
                   py="lg" style={{ borderTop: i ? "1px solid var(--mh-linha)" : 0 }}>
              <Text className="mh-serif" c="var(--mh-royal)" fz={44} lh={1} w={44}
                    aria-hidden="true">
                {i + 1}
              </Text>
              <Box>
                <Text fw={600} fz="xl">{passo.titulo}</Text>
                <Text c="dimmed" fz="lg" mt={4}>{passo.texto}</Text>
              </Box>
            </Group>
          ))}
        </Box>
      </Secao>

      <Secao fundo="azul" centro titulo="Perguntas frequentes">
        <Box maw={1000} mx="auto">
          <PerguntasFrequentes itens={duvidas} />
        </Box>
      </Secao>

      <ChamadaFinal papel={papel} rotulo={rotuloCadastro} {...chamada} />
    </>
  );
}
