import { Button, Stack, Text } from "@mantine/core";
import { IconInbox } from "@tabler/icons-react";

/**
 * Lista vazia. É convite para agir, não lamento: diz o que falta e oferece o
 * passo seguinte. Sem quadrado colorido com ícone grande — o ícone é pequeno
 * e cinza, e o destaque fica com o botão.
 */
export default function EmptyState({
  icon: Icon = IconInbox,
  title = "Nada por aqui ainda",
  description,
  action,
  compacto = false,
}) {
  return (
    <Stack align="center" gap={6} ta="center" py={compacto ? "lg" : 48} px="md"
           className="mh-bloco" style={{ borderStyle: "dashed" }}>
      <Icon size={26} stroke={1.5} color="var(--mh-tinta-3)" aria-hidden="true" />
      <Text fw={600} mt={4}>{title}</Text>
      {description && (
        <Text c="dimmed" size="sm" maw={420}>
          {description}
        </Text>
      )}
      {action && (
        <Button mt="sm" variant={action.variante || "filled"} onClick={action.onClick}
                leftSection={action.icon}>
          {action.label}
        </Button>
      )}
    </Stack>
  );
}
