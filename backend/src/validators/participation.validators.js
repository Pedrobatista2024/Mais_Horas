import { z } from "zod";

export const createParticipationSchema = z.object({
  activityId: z.string().uuid("Atividade inválida"),
});

export const validatePresenceSchema = z.object({
  status: z.enum(["pending", "present", "absent"], {
    errorMap: () => ({ message: "Status inválido" }),
  }),
});
