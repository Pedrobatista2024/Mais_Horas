import { asyncHandler } from "../middlewares/asyncHandler.js";
import { activityService } from "../services/activity.service.js";

export const createActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.create(req.user._id, req.body);
  res.status(201).json({ message: "Atividade criada com sucesso!", activity });
});

export const getAllActivities = asyncHandler(async (req, res) => {
  res.json(await activityService.listAll());
});

export const getMyActivities = asyncHandler(async (req, res) => {
  res.json(await activityService.listByOrg(req.user._id));
});

export const getActivityDetails = asyncHandler(async (req, res) => {
  res.json(await activityService.getDetails(req.params.id));
});

export const joinActivity = asyncHandler(async (req, res) => {
  await activityService.join(req.params.id, req.user._id);
  res.json({ message: "Inscrição realizada com sucesso!" });
});

export const updateActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.update(req.params.id, req.user._id, req.body);
  res.json({ message: "Atividade atualizada com sucesso", activity });
});

export const updateAttendance = asyncHandler(async (req, res) => {
  await activityService.updateAttendance(req.params.id, req.user._id, req.body);
  res.json({ message: "Presença atualizada com sucesso" });
});

export const finishActivity = asyncHandler(async (req, res) => {
  const result = await activityService.finish(req.params.id, req.user._id);
  res.json({ message: "Atividade finalizada com sucesso", ...result });
});

export const deleteActivity = asyncHandler(async (req, res) => {
  await activityService.remove(req.params.id, req.user._id);
  res.json({ message: "Atividade excluída" });
});
