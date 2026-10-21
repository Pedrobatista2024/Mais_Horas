import { Badge, Text } from "@mantine/core";

import { formatDate } from "../../utils/format";

/**
 * Caderneta de horas: cada certificado numa linha, as horas na coluna da
 * direita e a soma embaixo, fechada com traço duplo como num livro-caixa.
 *
 * É a forma que a coordenação do curso já conhece — a ficha de horas
 * complementares — e diz mais que um número solto: mostra de onde vem cada
 * hora. O total vem pronto do servidor (RN-16), não é somado aqui: certificado
 * revogado não conta, e quem sabe disso é a API.
 */
export default function Caderneta({ certificados, total, rotuloTotal = "Total validado" }) {
  return (
    <table className="mh-caderneta">
      <thead>
        <tr>
          <th scope="col">Data</th>
          <th scope="col">Atividade</th>
          <th scope="col" className="mh-col-horas">Horas</th>
        </tr>
      </thead>
      <tbody>
        {certificados.map((c) => (
          <tr key={c.id}>
            <td style={{ whiteSpace: "nowrap", width: "1%" }}>
              <Text size="sm" c="dimmed">{formatDate(c.dataAtividade)}</Text>
            </td>
            <td>
              <Text size="sm" fw={500} lineClamp={1}>{c.atividade}</Text>
              <Text size="xs" c="dimmed" lineClamp={1}>{c.organizacao}</Text>
              {c.revogado && <Badge color="red" mt={4}>Revogado</Badge>}
            </td>
            <td className="mh-col-horas">
              <Text size="sm" fw={500} td={c.revogado ? "line-through" : undefined}
                    c={c.revogado ? "dimmed" : undefined}>
                {c.horas} h
              </Text>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}><Text size="sm" fw={600}>{rotuloTotal}</Text></td>
          <td className="mh-col-horas">
            <span className="mh-horas" style={{ fontSize: "0.9375rem" }}>{total} h</span>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
