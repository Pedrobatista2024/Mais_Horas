import { Link } from "react-router-dom";
import {
  Alert, Anchor, Badge, Card, Group, List, Stack, Text, Title,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

import { useAuth } from "../context/AuthContext";

/**
 * Painel provisório enquanto `E1`/`O1`/`A1` não chegam.
 *
 * A implementação avança por fatia vertical (ver docs/plano-execucao.md): cada
 * uma entrega uma funcionalidade completa, do banco à tela. Esta página existe
 * para o pós-login ser honesto sobre o que já funciona, em vez de mostrar telas
 * que chamariam endpoints ainda inexistentes.
 */
const ATALHOS = {
  estudante: [
    { para: "/atividades", rotulo: "Buscar atividades" },
    { para: "/minhas-inscricoes", rotulo: "Minhas inscrições" },
    { para: "/check-in", rotulo: "Fazer check-in numa atividade em andamento" },
    { para: "/meus-certificados", rotulo: "Meus certificados" },
    { para: "/perfil", rotulo: "Meu perfil" },
  ],
  ong: [
    { para: "/ong/atividades", rotulo: "Minhas atividades" },
    { para: "/ong/atividades/nova", rotulo: "Publicar uma atividade" },
    { para: "/perfil", rotulo: "Dados da organização" },
  ],
};

const PROXIMAS = [
  { fatia: 9, titulo: "Portal", detalhe: "Página pública de apresentação" },
];

export default function EmConstrucao() {
  const { usuario } = useAuth();
  const papel = usuario?.papel;
  const atalhos = ATALHOS[papel] ?? ATALHOS.estudante;

  const rotulo = papel === "ong" ? "Painel da ONG"
    : papel === "superadmin" ? "Painel da administração"
    : "Painel do estudante";

  return (
    <Stack gap="lg" maw={640}>
      <Stack gap={4}>
        <Text tt="uppercase" c="brand.7" fw={700} size="xs">
          {rotulo}
        </Text>
        <Title order={1} fz={{ base: 26, sm: 32 }}>
          Olá, {usuario?.nome?.split(" ")[0]}
        </Title>
      </Stack>

      <Alert icon={<IconInfoCircle size={18} />} color="brand" variant="light">
        O painel com seus números entra junto com as fatias que faltam. Por enquanto,
        use o menu ao lado ou os atalhos abaixo.
      </Alert>

      <Card withBorder radius="md" p="lg">
        <Text fw={700} mb="sm">
          Já disponível
        </Text>
        <List spacing={8} size="sm">
          {atalhos.map((item) => (
            <List.Item key={item.para}>
              <Anchor component={Link} to={item.para} fw={600}>
                {item.rotulo}
              </Anchor>
            </List.Item>
          ))}
        </List>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Text fw={700} mb="sm">
          Em construção
        </Text>
        <Stack gap="sm">
          {PROXIMAS.map((item) => (
            <Group key={item.fatia} justify="space-between" wrap="wrap" gap="xs">
              <div style={{ minWidth: 0 }}>
                <Text fw={600} size="sm">
                  {item.titulo}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.detalhe}
                </Text>
              </div>
              <Badge variant="light" color="gray" radius="sm">
                Fatia {item.fatia}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
