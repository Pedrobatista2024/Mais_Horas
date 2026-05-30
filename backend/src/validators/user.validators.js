import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(100),
  role: z.enum(["student", "organization"]).optional().default("student"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Atualização de perfil: aceita qualquer subconjunto dos campos.
// Como pode vir via multipart (com foto), mantemos flexível e tratamos no controller.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),

    // aluno
    fullName: z.string().trim().max(120).optional(),
    sex: z.string().trim().max(30).optional(),
    birthDate: z.string().optional(),
    phone: z.string().trim().max(30).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    neighborhood: z.string().trim().max(80).optional(),
    institution: z.string().trim().max(120).optional(),
    courseName: z.string().trim().max(120).optional(),
    aboutMe: z.string().trim().max(1000).optional(),
    linkedin: z.string().trim().max(200).optional(),
    photoUrl: z.string().trim().max(500).optional(),

    // ong
    organizationName: z.string().trim().max(120).optional(),
    cnpj: z.string().trim().max(30).optional(),
    description: z.string().trim().max(1000).optional(),
    website: z.string().trim().max(200).optional(),
    instagram: z.string().trim().max(200).optional(),
    address: z.string().trim().max(200).optional(),
  })
  .passthrough();

export const idParam = z.object({ id: z.string().uuid("ID inválido") });
export const orgIdParam = z.object({ orgId: z.string().uuid("ID inválido") });
export const studentIdParam = z.object({ studentId: z.string().uuid("ID inválido") });
