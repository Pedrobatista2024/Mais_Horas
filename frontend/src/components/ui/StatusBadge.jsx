import { Badge } from "@mantine/core";

const MAP = {
  pending: { label: "Pendente", color: "yellow" },
  present: { label: "Presente", color: "brand" },
  absent: { label: "Ausente", color: "red" },
  active: { label: "Ativa", color: "brand" },
  finished: { label: "Finalizada", color: "navy" },
  cancelled: { label: "Cancelada", color: "gray" },
};

export default function StatusBadge({ status, ...props }) {
  const s = MAP[status] || { label: status || "—", color: "gray" };
  return (
    <Badge color={s.color} variant="light" radius="sm" {...props}>
      {s.label}
    </Badge>
  );
}
