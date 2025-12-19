import Participation from "../models/Participation.js";
import Certificate from "../models/Certificate.js";

export const studentDashboard = async (req, res) => {
  const userId = req.user._id;

  // Presenças
  const participations = await Participation.find({ user: userId })
    .populate("activity", "title date location");

  // Certificados
  const certificates = await Certificate.find({ user: userId })
    .populate("activity", "title date");

  // Total de horas
  const totalHours = certificates.reduce(
    (sum, cert) => sum + cert.hours,
    0
  );

  return res.json({
    participations,
    certificates,
    totalHours
  });
};
