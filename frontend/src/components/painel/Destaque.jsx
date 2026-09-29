import { Button, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { useNavigate } from "react-router-dom";

/**
 * A ação mais urgente do momento, no topo do painel.
 *
 * Era uma faixa azul com gradiente e título gigante — linguagem de página de
 * venda, não de ferramenta. Agora é uma barra discreta: o que importa é o
 * botão, e ele fica sempre no mesmo lugar.
 */
export default function Destaque({ destaque, catalogo, eyebrow }) {
  const navegar = useNavigate();
  const modelo = catalogo[destaque?.tipo] ?? catalogo.nenhum;
  const urgente = destaque?.tipo !== "nenhum";

  return (
    <Paper withBorder p="md"
           style={urgente
             ? { borderLeft: "3px solid var(--mantine-color-brand-6)" }
             : undefined}>
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon variant="transparent" color={urgente ? "brand" : "gray"}
                     size={24} style={{ flexShrink: 0 }}>
            <modelo.icone size={20} />
          </ThemeIcon>
          <Stack gap={2}>
            {eyebrow && <Text size="xs" c="dimmed">{eyebrow}</Text>}
            <Text fw={600}>{destaque?.titulo}</Text>
            {destaque?.mensagem && (
              <Text size="sm" c="dimmed">{destaque.mensagem}</Text>
            )}
          </Stack>
        </Group>
        <Button variant={urgente ? "filled" : "default"}
                onClick={() => navegar(modelo.destino(destaque))}>
          {modelo.rotulo}
        </Button>
      </Group>
    </Paper>
  );
}
