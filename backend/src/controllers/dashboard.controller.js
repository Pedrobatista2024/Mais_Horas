import { asyncHandler } from "../middlewares/asyncHandler.js";
import { participationService } from "../services/participation.service.js";
import { certificateService } from "../services/certificate.service.js";

export const studentDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [participations, certificates] = await Promise.all([
    participationService.listMine(userId),
    certificateService.listMine(userId),
  ]);
  const totalHours = certificates.reduce((sum, c) => sum + (c.hours || 0), 0);
  res.json({ participations, certificates, totalHours });
});
