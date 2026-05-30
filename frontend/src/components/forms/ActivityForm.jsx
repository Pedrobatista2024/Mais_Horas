import {
  Paper,
  SimpleGrid,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Alert,
} from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconDeviceFloppy, IconInfoCircle } from "@tabler/icons-react";
import dayjs from "dayjs";

/**
 * Formulário compartilhado de atividade (criar e editar).
 * - lockedExceptLimits: quando a atividade já tem inscritos, só min/max são editáveis.
 */
export default function ActivityForm({
  initialValues,
  onSubmit,
  submitLabel = "Salvar",
  onCancel,
  lockedExceptLimits = false,
  loading = false,
}) {
  const form = useForm({
    initialValues: {
      title: "",
      location: "",
      date: null,
      startTime: "",
      endTime: "",
      workloadHours: "",
      minParticipants: 1,
      maxParticipants: 20,
      description: "",
      ...initialValues,
    },
    validate: {
      title: (v) =>
        lockedExceptLimits ? null : !v?.trim() ? "Título é obrigatório" : v.length > 40 ? "Máx 40 caracteres" : null,
      location: (v) =>
        lockedExceptLimits ? null : !v?.trim() ? "Local é obrigatório" : v.length > 50 ? "Máx 50 caracteres" : null,
      date: (v) => {
        if (lockedExceptLimits) return null;
        if (!v) return "Data é obrigatória";
        if (dayjs(v).startOf("day").isBefore(dayjs().startOf("day"))) return "Data não pode ser no passado";
        return null;
      },
      startTime: (v) => (lockedExceptLimits ? null : !v ? "Obrigatório" : null),
      endTime: (v, values) =>
        lockedExceptLimits ? null : !v ? "Obrigatório" : v <= values.startTime ? "Deve ser após o início" : null,
      workloadHours: (v) =>
        lockedExceptLimits ? null : !v || Number(v) <= 0 ? "Deve ser maior que 0" : null,
      description: (v) =>
        lockedExceptLimits ? null : !v?.trim() ? "Descrição é obrigatória" : v.length > 1500 ? "Máx 1500 caracteres" : null,
      maxParticipants: (v, values) =>
        Number(v) < Number(values.minParticipants) ? "Não pode ser menor que o mínimo" : null,
    },
  });

  function handleSubmit(values) {
    const payload = {
      ...values,
      date: values.date ? dayjs(values.date).format("YYYY-MM-DD") : undefined,
      workloadHours: Number(values.workloadHours),
      minParticipants: Number(values.minParticipants),
      maxParticipants: Number(values.maxParticipants),
    };
    onSubmit(payload, form);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Paper withBorder radius="md" p="xl">
        {lockedExceptLimits && (
          <Alert icon={<IconInfoCircle size={18} />} color="navy" mb="lg">
            Esta atividade já tem inscritos. Por isso, só é possível ajustar o número mínimo e máximo
            de participantes.
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Título"
            maxLength={40}
            disabled={lockedExceptLimits}
            {...form.getInputProps("title")}
          />
          <TextInput
            label="Local"
            maxLength={50}
            disabled={lockedExceptLimits}
            {...form.getInputProps("location")}
          />
          <DateInput
            label="Data"
            valueFormat="DD/MM/YYYY"
            disabled={lockedExceptLimits}
            minDate={new Date()}
            {...form.getInputProps("date")}
          />
          <NumberInput
            label="Carga horária (h)"
            min={1}
            disabled={lockedExceptLimits}
            {...form.getInputProps("workloadHours")}
          />
          <TimeInput
            label="Hora de início"
            disabled={lockedExceptLimits}
            {...form.getInputProps("startTime")}
          />
          <TimeInput
            label="Hora de fim"
            disabled={lockedExceptLimits}
            {...form.getInputProps("endTime")}
          />
          <NumberInput
            label="Mínimo de participantes"
            min={1}
            {...form.getInputProps("minParticipants")}
          />
          <NumberInput
            label="Máximo de participantes"
            min={1}
            {...form.getInputProps("maxParticipants")}
          />
        </SimpleGrid>

        <Textarea
          label="Descrição"
          mt="md"
          autosize
          minRows={5}
          maxLength={1500}
          disabled={lockedExceptLimits}
          placeholder="Explique o que será feito, público-alvo, materiais necessários, orientações..."
          {...form.getInputProps("description")}
        />

        <Group justify="flex-end" mt="xl">
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" loading={loading} leftSection={<IconDeviceFloppy size={18} />}>
            {submitLabel}
          </Button>
        </Group>
      </Paper>
    </form>
  );
}
