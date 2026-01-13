import User from "../models/user.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "student" // padrão se não enviar
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso",
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: generateToken(user._id),
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro no servidor" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Usuário não encontrado" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Senha incorreta" });
    }

    return res.status(200).json({
      message: "Login realizado",
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: generateToken(user._id),
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro no servidor" });
  }
};
