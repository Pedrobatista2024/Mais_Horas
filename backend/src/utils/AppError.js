/**
 * Erro de negócio com status HTTP. Lançado pelos services/controllers
 * e formatado pelo middleware de erro central.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export default AppError;
