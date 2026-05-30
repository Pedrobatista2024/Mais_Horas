import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createActivitySchema = z
  .object({
    title: z.string().trim().min(1, "Título é obrigatório").max(40, "Título: máx 40 caracteres"),
    description: z
      .string()
      .trim()
      .min(1, "Descrição é obrigatória")
      .max(1500, "Descrição: máx 1500 caracteres"),
    location: z.string().trim().min(1, "Local é obrigatório").max(50, "Local: máx 50 caracteres"),
    date: z.string().regex(dateOnlyRegex, "Data deve estar no formato AAAA-MM-DD"),
    startTime: z.string().regex(timeRegex, "Hora de início inválida"),
    endTime: z.string().regex(timeRegex, "Hora de fim inválida"),
    workloadHours: z.coerce.number().int().positive("Carga horária deve ser maior que 0"),
    minParticipants: z.coerce.number().int().min(1).default(1),
    maxParticipants: z.coerce.number().int().min(1).default(20),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "A hora de início deve ser menor que a de fim",
    path: ["startTime"],
  })
  .refine((d) => d.maxParticipants >= d.minParticipants, {
    message: "Máximo de participantes não pode ser menor que o mínimo",
    path: ["maxParticipants"],
  });

export const updateActivitySchema = z.object({
  title: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().min(1).max(1500).optional(),
  location: z.string().trim().min(1).max(50).optional(),
  date: z.string().regex(dateOnlyRegex, "Data deve estar no formato AAAA-MM-DD").optional(),
  startTime: z.string().regex(timeRegex, "Hora de início inválida").optional(),
  endTime: z.string().regex(timeRegex, "Hora de fim inválida").optional(),
  workloadHours: z.coerce.number().int().positive().optional(),
  minParticipants: z.coerce.number().int().min(1).optional(),
  maxParticipants: z.coerce.number().int().min(1).optional(),
});

export const attendanceSchema = z.object({
  userId: z.string().uuid("ID do aluno inválido"),
  status: z.enum(["present", "absent"], { errorMap: () => ({ message: "Status inválido" }) }),
});
