import { Button } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";

export default function BackButton({ onClick, label = "Voltar", ...props }) {
  return (
    <Button
      variant="subtle"
      color="gray"
      leftSection={<IconArrowLeft size={18} />}
      onClick={onClick}
      mb="md"
      {...props}
    >
      {label}
    </Button>
  );
}
