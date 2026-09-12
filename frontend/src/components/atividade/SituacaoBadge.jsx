import { Badge } from "@mantine/core";

import { SITUACOES } from "./situacoes";

export default function SituacaoBadge({ situacao, ...props }) {
  const item = SITUACOES[situacao] || { rotulo: situacao || "—", cor: "gray" };
  return (
    <Badge color={item.cor} variant="light" radius="sm" {...props}>
      {item.rotulo}
    </Badge>
  );
}
