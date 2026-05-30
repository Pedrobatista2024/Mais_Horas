import { asyncHandler } from "../middlewares/asyncHandler.js";
import { participationService } from "../services/participation.service.js";

export const createParticipation = asyncHandler(async (req, res) => {
  const participation = await participationService.create(req.user._id, req.body.activityId);
  res.status(201).json({ message: "Participação registrada", participation });
});

export const validatePresence = asyncHandler(async (req, res) => {
  const participation = await participationService.validatePresence(
    req.params.participationId,
    req.user._id,
    req.body.status
  );
  res.json({ message: "Presença atualizada!", participation });
});

export const getUserParticipations = asyncHandler(async (req, res) => {
  res.json(await participationService.listMine(req.user._id));
});

export const getActivityParticipations = asyncHandler(async (req, res) => {
  res.json(await participationService.listByActivity(req.params.activityId));
});
