import { Anchor, Box, Group, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { useTitulo } from "../../hooks/useTitulo";

/**
 * Cabeçalho de página: título, uma linha de contexto e as ações.
 *
 * Não tem rótulo miúdo acima do título: o menu lateral já diz em que área a
 * pessoa está, e uma etiqueta em cima de cada título faz todas as telas
 * parecerem a mesma. Quem desce um nível (uma atividade dentro da lista) ganha
 * o `voltar`, que diz para onde volta.
 *
 * `badge` é um nó (um `SituacaoBadge`, por exemplo) e fica ao lado do título.
 * `children` entra abaixo do subtítulo, para metadados.
 */
export default function PageHeader({ title, subtitle, action, voltar, badge, children }) {
  useTitulo(typeof title === "string" ? title : undefined);

  return (
    <Box component="header" mb={{ base: "lg", sm: 28 }}>
      {voltar && (
        <Anchor component={Link} to={voltar.para} size="sm" c="dimmed"
                underline="hover" display="inline-flex" mb="sm"
                style={{ alignItems: "center", gap: 6 }}>
          <IconArrowLeft size={15} aria-hidden="true" />
          {voltar.rotulo}
        </Anchor>
      )}
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Box style={{ flex: "1 1 320px", minWidth: 0 }}>
          <Group gap="sm" align="center" wrap="wrap">
            <Title order={1}>{title}</Title>
            {badge}
          </Group>
          {subtitle && (
            <Text c="dimmed" mt={6} maw={680}>
              {subtitle}
            </Text>
          )}
          {children}
        </Box>
        {action && (
          <Group gap="xs" wrap="wrap">
            {action}
          </Group>
        )}
      </Group>
    </Box>
  );
}
