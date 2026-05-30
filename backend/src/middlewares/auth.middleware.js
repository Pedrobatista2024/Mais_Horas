import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "./asyncHandler.js";

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Token não fornecido", 401);
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError("Token inválido", 401);
  }

  const user = await User.findById(decoded.userId);
  if (!user) throw new AppError("Usuário não encontrado", 404);

  req.user = user;
  next();
});
