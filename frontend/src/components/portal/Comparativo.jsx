import { Box, Group, Text } from "@mantine/core";
import { IconCircleCheckFilled } from "@tabler/icons-react";

import ClockGlyph from "../ui/ClockGlyph";

const LINHAS = [
  ["Como a faculdade confere", "Liga para a ONG, quando consegue", "Lê o QR Code e vê na hora"],
  ["Registro de presença", "Lista assinada no papel", "QR que muda a cada 30 segundos"],
  ["Se alguém editar o arquivo", "Ninguém percebe", "A verificação mostra a adulteração"],
  ["Onde ficam as horas", "Uma pasta de declarações", "Uma caderneta que soma sozinha"],
  ["Quanto custa", "Papel, impressão e assinatura", "Nada"],
];

/**
 * Comprovação em papel contra a Mais Horas, linha a linha. A coluna da
 * plataforma é branca e destacada, as outras ficam no fundo da seção.
 */
export default function Comparativo() {
  return (
    <Box className="mh-comparativo-moldura">
      <table className="mh-comparativo">
        <thead>
          <tr>
            <th scope="col"><span className="mh-pular-visual">Aspecto</span></th>
            <th scope="col" className="mh-col-nossa">
              <Group gap={4} wrap="nowrap" justify="center">
                <Text fw={700} c="var(--mh-tinta)">Mais</Text>
                <ClockGlyph size={18} idSuffix="comparativo" />
                <Text fw={700} c="var(--mh-royal)" ml={-3}>Horas</Text>
              </Group>
            </th>
            <th scope="col" className="mh-col-outra">Declaração em papel</th>
          </tr>
        </thead>
        <tbody>
          {LINHAS.map(([aspecto, papel, nos]) => (
            <tr key={aspecto}>
              <th scope="row" style={{ fontWeight: 600 }}>{aspecto}</th>
              <td className="mh-col-nossa">
                <Group gap={8} wrap="nowrap">
                  <IconCircleCheckFilled size={18} color="var(--mh-royal)" aria-hidden="true"
                                         style={{ flexShrink: 0 }} />
                  {nos}
                </Group>
              </td>
              <td className="mh-col-outra">{papel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
