import { Box, SimpleGrid, Text } from "@mantine/core";

/**
 * Uma fileira de números com rótulo, separados por fio — não um cartão para
 * cada um. Número solto num cartão próprio, com ícone e cor, é o enfeite mais
 * repetido de painel; aqui o número é dado, e dado se lê em fila.
 *
 * O fio entre as células é uma sombra de 1px à direita e embaixo de cada
 * uma: vale em qualquer quebra de linha, e a célula que sobra fica em branco.
 *
 * No celular cada número vira uma linha, rótulo à esquerda e valor à direita:
 * empilhados no formato de coluna, três números ocupavam a tela inteira.
 *
 * `itens`: [{ rotulo, valor, detalhe? }]
 */
export default function Numeros({ itens, colunas }) {
  const lista = itens.filter(Boolean);
  const padrao = { base: 1, xs: Math.min(lista.length, 3), md: Math.min(lista.length, 4) };
  return (
    <SimpleGrid cols={colunas || padrao} spacing={0} verticalSpacing={0}
                className="mh-numeros">
      {lista.map((item) => (
        <Box key={item.rotulo} className="mh-numero">
          <Text size="sm" c="dimmed" className="mh-numero-rotulo">{item.rotulo}</Text>
          <Text fw={600} lh={1.2} className="mh-num mh-numero-valor">
            {item.valor}
          </Text>
          {item.detalhe && (
            <Text size="xs" c="dimmed" className="mh-numero-detalhe">{item.detalhe}</Text>
          )}
        </Box>
      ))}
    </SimpleGrid>
  );
}
