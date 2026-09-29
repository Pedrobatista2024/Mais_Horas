import { Anchor, Group, Paper, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";

/**
 * Atalho para outra tela.
 *
 * Era um cartão com ícone grande colorido e botão cheio; virou uma linha
 * clicável com o essencial. Num painel com quatro atalhos, quatro botões
 * competem entre si e nenhum vence.
 */
export default function ActionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
}) {
  return (
    <Paper withBorder p="md" className="mh-card-hover" onClick={onClick}
           style={{ cursor: "pointer", height: "100%" }}
           role="link" tabIndex={0}
           onKeyDown={(e) => { if (e.key === "Enter") onClick?.(); }}>
      <Stack gap={6} h="100%">
        <Group gap={8} wrap="nowrap">
          {Icon && <Icon size={17} color="var(--mantine-color-brand-7)" />}
          <Text fw={600}>{title}</Text>
        </Group>
        <Text c="dimmed" size="sm" style={{ flex: 1 }}>
          {description}
        </Text>
        {actionLabel && (
          <Anchor component="span" size="sm" fw={500}>
            <Group gap={4} wrap="nowrap">
              {actionLabel}
              <IconArrowRight size={14} />
            </Group>
          </Anchor>
        )}
      </Stack>
    </Paper>
  );
}
