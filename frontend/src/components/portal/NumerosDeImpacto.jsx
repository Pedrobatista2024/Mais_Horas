import { Paper, SimpleGrid, Text, ThemeIcon } from "@mantine/core";

import { numerosVisiveis } from "./impacto";

/**
 * Impacto em números — só o que o banco confirma.
 *
 * Número zerado não aparece, e sem nenhum número a seção inteira some: vitrine
 * com "0 horas" ou com contagem inventada depõe contra o projeto do mesmo jeito.
 */
export default function NumerosDeImpacto({ resumo }) {
  const visiveis = numerosVisiveis(resumo);
  if (visiveis.length === 0) return null;

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: visiveis.length }} spacing="md">
      {visiveis.map(({ chave, rotulo, icone: Icone, cor }) => (
        <Paper key={chave} withBorder radius="lg" p="lg" ta="center">
          <ThemeIcon size={44} radius="md" variant="light" color={cor} mx="auto" mb="sm">
            <Icone size={24} />
          </ThemeIcon>
          <Text fw={900} fz={{ base: 26, sm: 32 }} lh={1}>
            {resumo[chave].toLocaleString("pt-BR")}
          </Text>
          <Text size="sm" c="dimmed" mt={4}>{rotulo[resumo[chave] === 1 ? 0 : 1]}</Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
