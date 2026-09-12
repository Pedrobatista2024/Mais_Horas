import { Link } from "react-router-dom";
import {
  Alert, Anchor, Badge, Button, Card, Group, List, Stack, Text, Title,
} from "@mantine/core";
import { IconInfoCircle, IconLogout } from "@tabler/icons-react";

import PublicPage from "../components/layout/PublicPage";
import { useAuth } from "../context/AuthContext";

/**
 * Painel provisório enquanto as demais fatias não chegam.
 *
 * A implementação avança por fatia vertical (ver docs/plano-execucao.md): cada
 * uma entrega uma funcionalidade completa, do banco à tela. Esta página existe
 * para o pós-login ser honesto sobre o que já funciona, em vez de mostrar telas
 * que chamariam endpoints ainda inexistentes.
 */
const PROXIMAS = [
  { fatia: 2, titulo: "Perfil", detalhe: "Preencher seus dados e foto" },
  { fatia: 3, titulo: "Atividades", detalhe: "Publicar e encontrar oportunidades" },
  { fatia: 4, titulo: "Inscrições", detalhe: "Inscrever-se, aprovar, cancelar" },
  { fatia: 5, titulo: "Presença", detalhe: "Check-in por QR Code rotativo" },
  { fatia: 6, titulo: "Certificado", detalhe: "Emissão assinada e verificação pública" },
];

export default function EmConstrucao() {
  const { usuario, sair } = useAuth();

  return (
    <PublicPage>
      <Stack gap="lg" maw={620} mx="auto" w="100%">
        <Stack gap={4}>
          <Text tt="uppercase" c="brand.7" fw={700} size="xs">
            {usuario?.papel === "ong" ? "Painel da ONG" : "Painel do estudante"}
          </Text>
          <Title order={2} fz={{ base: 26, sm: 32 }}>
            Olá, {usuario?.nome?.split(" ")[0]}
          </Title>
        </Stack>

        <Alert icon={<IconInfoCircle size={18} />} color="brand" variant="light">
          Sua conta está criada e o acesso funcionando. As demais áreas estão sendo
          construídas e entram em seguida.
        </Alert>

        <Card withBorder radius="md" p="lg">
          <Text fw={700} mb="sm">
            Já disponível
          </Text>
          <List spacing={6} size="sm">
            <List.Item>Criar conta e entrar</List.Item>
            <List.Item>Sessão que sobrevive ao recarregar a página</List.Item>
            <List.Item>Recuperação de senha</List.Item>
          </List>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Text fw={700} mb="sm">
            Em construção
          </Text>
          <Stack gap="xs">
            {PROXIMAS.map((item) => (
              <Group key={item.fatia} justify="space-between" wrap="wrap" gap="xs">
                <div>
                  <Text size="sm" fw={600}>
                    {item.titulo}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {item.detalhe}
                  </Text>
                </div>
                <Badge variant="light" color="ink">
                  Fatia {item.fatia}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>

        <Group justify="space-between" wrap="wrap">
          <Anchor component={Link} to="/" size="sm">
            Voltar ao início
          </Anchor>
          <Button
            variant="light"
            color="ink"
            leftSection={<IconLogout size={16} />}
            onClick={sair}
          >
            Sair da conta
          </Button>
        </Group>
      </Stack>
    </PublicPage>
  );
}
