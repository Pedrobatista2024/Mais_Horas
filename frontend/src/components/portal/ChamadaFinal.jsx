import { Link } from "react-router-dom";
import { Box, Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { cadastroComo } from "./navegacao";

/** Faixa azul do fim das páginas: converte em cadastro (ou leva ao painel). */
export default function ChamadaFinal({
  titulo = "Comece a somar horas que transformam",
  texto = "Crie sua conta gratuita e participe da primeira atividade.",
  papel = "estudante",
  rotulo = "Criar conta grátis",
}) {
  const { autenticado, usuario } = useAuth();

  return (
    <Box className="mh-hero">
      <Container size="xl" py={{ base: 48, md: 64 }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="lg">
          <Stack gap={4} maw={640}>
            <Title order={2} c="white" className="mh-display">{titulo}</Title>
            <Text c="rgba(255,255,255,0.9)">{texto}</Text>
          </Stack>
          {autenticado ? (
            <Button size="lg" color="clay" component={Link} to={painelDe(usuario?.papel)}
                    rightSection={<IconArrowRight size={18} />}>
              Ir para o painel
            </Button>
          ) : (
            <Group gap="md">
              <Button size="lg" color="clay" component={Link} to={cadastroComo(papel)}
                      rightSection={<IconArrowRight size={18} />}>
                {rotulo}
              </Button>
              <Button size="lg" variant="white" color="dark" component={Link} to="/entrar">
                Já tenho conta
              </Button>
            </Group>
          )}
        </Group>
      </Container>
    </Box>
  );
}
