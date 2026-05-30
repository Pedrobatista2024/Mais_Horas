import { AppError } from "../utils/AppError.js";

/**
 * Garante que o usuário autenticado tem um dos papéis exigidos.
 * Deve rodar depois do authMiddleware.
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Não autenticado", 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError("Acesso negado para o seu perfil", 403));
  }
  next();
};

export default requireRole;
