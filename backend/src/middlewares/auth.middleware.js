import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar o usuário no banco e remover a senha da resposta
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Disponibiliza o usuário inteiro para as próximas rotas
    req.user = user;

    next(); // segue a execução

  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
};
