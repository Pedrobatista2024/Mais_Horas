import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

/** Rota não encontrada */
export const notFound = (req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
};

/** Tratamento de erro central — formato único de resposta */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Erro de validação do zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Dados inválidos",
      details: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // Erro de negócio conhecido
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Violação de unique do Postgres (ex.: email duplicado)
  if (err?.code === "23505") {
    return res.status(409).json({ message: "Registro já existe" });
  }

  // Erros do multer (upload)
  if (err?.name === "MulterError") {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "Arquivo muito grande (máx 2MB)"
        : "Erro no upload do arquivo";
    return res.status(400).json({ message: msg });
  }

  console.error("Erro não tratado:", err);
  return res.status(500).json({ message: "Erro interno no servidor" });
};
