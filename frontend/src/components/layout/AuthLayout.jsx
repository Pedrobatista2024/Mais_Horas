import { Box, Center, Paper, Stack, Text, Title } from "@mantine/core";

import BrandMark from "../ui/BrandMark";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <Box className="mh-auth-page">
      <Center mih="100vh" p={{ base: "md", sm: "xl" }}>
        <Stack w="100%" maw={430} gap="lg">
          <Stack align="center" gap="xs">
            <BrandMark showTagline align="center" />
          </Stack>

          <Paper withBorder shadow="sm" radius="md" p={{ base: "lg", sm: "xl" }}>
            {title && (
              <Title order={2} fz={{ base: 26, sm: 30 }} mb={subtitle ? 4 : "lg"}>
                {title}
              </Title>
            )}
            {subtitle && (
              <Text c="dimmed" size="sm" mb="lg">
                {subtitle}
              </Text>
            )}
            {children}
          </Paper>
        </Stack>
      </Center>
    </Box>
  );
}
