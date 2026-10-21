import { Link } from "react-router-dom";
import { Box, Button, Container, Group, Text, Title } from "@mantine/core";

import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { cadastroComo, LARGURA_DO_PORTAL } from "./navegacao";

/**
 * O fechamento de uma página do portal, em azul-noite: uma frase em Fraunces e
 * o próximo passo. É a última seção antes do rodapé.
 */
export default function ChamadaFinal({
  titulo = "Pronto para a primeira atividade?",
  texto = "A conta é gratuita e fica pronta em um minuto.",
  papel = "estudante",
  rotulo = "Criar conta",
}) {
  const { autenticado, usuario } = useAuth();

  return (
    <Box component="section" className="mh-secao mh-secao-noite">
      <Container size={LARGURA_DO_PORTAL}>
        <Group justify="space-between" align="center" wrap="wrap" gap="xl">
          <Box maw={660}>
            <Title order={2} className="mh-serif" c="white" fz={{ base: 30, md: 44 }}>
              {titulo}
            </Title>
            <Text c="rgba(255,255,255,0.78)" fz="lg" mt="sm">{texto}</Text>
          </Box>
          {autenticado ? (
            <Button variant="white" component={Link} to={painelDe(usuario?.papel)}
                    className="mh-botao-portal">
              Ir para o painel
            </Button>
          ) : (
            <Group gap="sm">
              <Button variant="white" component={Link} to={cadastroComo(papel)}
                      className="mh-botao-portal">
                {rotulo}
              </Button>
              <Button variant="outline" color="#ffffff" component={Link} to="/entrar"
                      className="mh-botao-portal">
                Já tenho conta
              </Button>
            </Group>
          )}
        </Group>
      </Container>
    </Box>
  );
}
