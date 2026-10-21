import { Accordion, SimpleGrid, Text } from "@mantine/core";

/**
 * Perguntas frequentes em cartões brancos, em duas colunas no computador.
 * `itens`: [{ pergunta, resposta }]
 */
export default function PerguntasFrequentes({ itens }) {
  const meio = Math.ceil(itens.length / 2);
  const colunas = [itens.slice(0, meio), itens.slice(meio)];
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing={12} verticalSpacing={0} className="mh-faq">
      {colunas.map((coluna, i) => (
        <Accordion key={i} chevronPosition="right" variant="default">
          {coluna.map(({ pergunta, resposta }) => (
            <Accordion.Item key={pergunta} value={pergunta}>
              <Accordion.Control><Text fw={600}>{pergunta}</Text></Accordion.Control>
              <Accordion.Panel><Text c="dimmed">{resposta}</Text></Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      ))}
    </SimpleGrid>
  );
}
