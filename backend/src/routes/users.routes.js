import express from "express";
import User from "../models/user.js";   // ← AJUSTADO
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// Rota de cadastro
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verificar se email já existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso!",
      userId: newUser._id,
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// Rota de login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Usuário não encontrado" });
    }

    // Verificar senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Senha incorreta" });
    }

    // Criar token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login realizado",
      token,
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

export default router;
