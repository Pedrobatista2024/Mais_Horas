import { Grid, Stack, Text, Title } from "@mantine/core";

/**
 * Um bloco de formulário: à esquerda o que é e por que se pede, à direita os
 * campos. No celular o texto vem em cima. Dizer para que serve cada dado é o
 * que faz a pessoa preencher certo, e o fio entre os blocos separa os assuntos
 * sem precisar de um cartão para cada um. O formulário inteiro mora num bloco
 * branco só (`.mh-formulario`).
 */
export default function SecaoDeFormulario({ titulo, texto, children }) {
  return (
    <Grid gutter={{ base: "sm", md: 40 }} py="lg" className="mh-secao-formulario">
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Title order={2} fz="md">{titulo}</Title>
        {texto && <Text size="sm" c="dimmed" mt={4}>{texto}</Text>}
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack gap="md" maw={600}>{children}</Stack>
      </Grid.Col>
    </Grid>
  );
}
