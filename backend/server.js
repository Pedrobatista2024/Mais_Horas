import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";

import { connectDB } from "./src/config/database.js";
import { notFound, errorHandler } from "./src/middlewares/error.middleware.js";

import usersRoutes from "./src/routes/users.routes.js";
import activityRoutes from "./src/routes/activity.routes.js";
import participationRoutes from "./src/routes/participation.routes.js";
import certificateRoutes from "./src/routes/certificate.routes.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";

// ===== Checagens de ambiente =====
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET não definido. Configure no .env antes de iniciar.");
  process.exit(1);
}

const app = express();

// ===== Segurança =====
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: libera a origem do frontend (ou tudo, em dev)
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({ origin: corsOrigin ? corsOrigin.split(",") : true }));

// ===== Body parsing (limite alto p/ upload base64 eventual) =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ===== Uploads estáticos =====
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

// ===== Rotas =====
app.get("/", (req, res) => res.send("API Mais Horas rodando e conectada ao PostgreSQL!"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/users", usersRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/participations", participationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ===== 404 + erro central =====
app.use(notFound);
app.use(errorHandler);

// ===== Boot =====
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
});
