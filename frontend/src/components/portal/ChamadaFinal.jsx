import { Link } from "react-router-dom";
import { Box, Button, Container, Group, Text, Title } from "@mantine/core";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { cadastroComo, LARGURA_DO_PORTAL } from "./navegacao";

/**
 * O fim de uma página do portal: uma frase e o próximo passo. Era uma faixa
 * azul com botão âmbar e seta, repetida no fim de cada página; virou um
 * fechamento discreto, separado por um fio.
 */
export default function ChamadaFinal({
  titulo = "Pronto para a primeira atividade?",
  texto = "A conta é gratuita e fica pronta em um minuto.",
  papel = "estudante",
  rotulo = "Criar conta",
}) {
  const { autenticado, usuario } = useAuth();

  return (
    <Box className="mh-secao" style={{ borderTop: "1px solid var(--mh-linha)" }}>
      <Container size={LARGURA_DO_PORTAL}>
        <Group justify="space-between" align="center" wrap="wrap" gap="lg">
          <Box maw={640}>
            <Title order={2} fz={{ base: 24, md: 28 }}>{titulo}</Title>
            <Text c="dimmed" fz="lg" mt={6}>{texto}</Text>
          </Box>
          {autenticado ? (
            <Button size="md" component={Link} to={painelDe(usuario?.papel)}>
              Ir para o painel
            </Button>
          ) : (
            <Group gap="sm">
              <Button size="md" component={Link} to={cadastroComo(papel)}>{rotulo}</Button>
              <Button size="md" variant="default" component={Link} to="/entrar">
                Já tenho conta
              </Button>
            </Group>
          )}
        </Group>
      </Container>
    </Box>
  );
}
