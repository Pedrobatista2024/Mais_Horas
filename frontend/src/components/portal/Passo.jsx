import { Box, Text } from "@mantine/core";

/**
 * Um passo da jornada. O número vem grande e fino, porque aqui a ordem é a
 * informação: primeiro a ONG publica, depois o aluno se inscreve. Sem cartão
 * e sem ícone colorido — o fio em cima liga um passo ao seguinte.
 */
export default function Passo({ numero, titulo, children }) {
  return (
    <Box pt="md" style={{ borderTop: "2px solid var(--mh-linha-forte)" }}>
      <Text className="mh-passo-numero" aria-hidden="true">{numero}</Text>
      <Text fw={600} fz="lg" mt="sm" mb={4}>{titulo}</Text>
      <Text c="dimmed">{children}</Text>
    </Box>
  );
}
