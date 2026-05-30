import { asyncHandler } from "../middlewares/asyncHandler.js";
import { userService } from "../services/user.service.js";

export const register = asyncHandler(async (req, res) => {
  const result = await userService.register(req.body);
  res.status(201).json({ message: "Usuário criado com sucesso", ...result });
});

export const login = asyncHandler(async (req, res) => {
  const result = await userService.login(req.body);
  res.json({ message: "Login realizado", ...result });
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  res.json({ message: "Perfil carregado com sucesso", user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body, req.file);
  res.json({ message: "Perfil atualizado com sucesso", user });
});

export const getOrgPublicProfile = asyncHandler(async (req, res) => {
  const user = await userService.getOrgPublic(req.params.orgId);
  res.json({ message: "Perfil público da ONG carregado com sucesso", user });
});

export const getStudentPublicProfile = asyncHandler(async (req, res) => {
  const user = await userService.getStudentPublic(req.params.studentId);
  res.json({ message: "Perfil público do aluno carregado com sucesso", user });
});
