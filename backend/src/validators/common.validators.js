import { z } from "zod";

export const idParam = z.object({
  id: z.string().uuid("ID inválido"),
});

export const participationIdParam = z.object({
  participationId: z.string().uuid("ID inválido"),
});

export const activityIdParam = z.object({
  activityId: z.string().uuid("ID inválido"),
});

export const codeParam = z.object({
  code: z.string().min(4, "Código inválido"),
});
