import { Box, Button, Group, Stack, Text, Title, ThemeIcon } from "@mantine/core";

/**
 * Banner de boas-vindas com gradiente azul royal (estilo hero) para o topo
 * dos painéis. Dá cara de produto às telas internas.
 */
export default function WelcomeBanner({ eyebrow, title, subtitle, action, icon: Icon }) {
  return (
    <Box
      className="mh-hero"
      p={{ base: "lg", sm: "xl" }}
      mb="xl"
      style={{ borderRadius: 16, position: "relative", overflow: "hidden" }}
    >
      <div className="mh-hero-orb" style={{ width: 240, height: 240, right: -60, top: -90 }} />
      <div className="mh-hero-orb" style={{ width: 150, height: 150, right: 80, bottom: -70 }} />
      <Group justify="space-between" align="center" wrap="wrap" gap="lg" style={{ position: "relative" }}>
        <Group wrap="nowrap" align="center" gap="md">
          {Icon && (
            <ThemeIcon
              size={56}
              radius="md"
              variant="white"
              color="brand"
              visibleFrom="sm"
              style={{ flexShrink: 0 }}
            >
              <Icon size={30} />
            </ThemeIcon>
          )}
          <Stack gap={2}>
            {eyebrow && (
              <Text tt="uppercase" fw={800} size="xs" c="rgba(255,255,255,0.8)">
                {eyebrow}
              </Text>
            )}
            <Title order={2} c="white" lh={1.1}>
              {title}
            </Title>
            {subtitle && (
              <Text c="rgba(255,255,255,0.9)" size="sm" maw={520}>
                {subtitle}
              </Text>
            )}
          </Stack>
        </Group>
        {action}
      </Group>
    </Box>
  );
}
