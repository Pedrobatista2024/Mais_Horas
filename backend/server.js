import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./src/config/database.js";
import usersRoutes from "./src/routes/users.routes.js";
import activityRoutes from "./src/routes/activity.routes.js";
import participationRoutes from "./src/routes/participation.routes.js";
import certificateRoutes from "./src/routes/certificate.routes.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";
import path from "path";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", usersRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/participations", participationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/uploads", express.static(path.resolve("uploads")));

// Conectar ao banco
connectDB();

app.get("/", (req, res) => {
  res.send("API do MVP rodando e conectada ao MongoDB!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
