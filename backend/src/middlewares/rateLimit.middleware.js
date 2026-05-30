import rateLimit from "express-rate-limit";

/**
 * Limita tentativas em rotas sensíveis (login/registro) para mitigar
 * ataques de força-bruta.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20, // 20 tentativas por IP na janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

export default authLimiter;
