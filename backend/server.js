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
import fs from 'fs';

dotenv.config();

const app = express();

// 1. CONFIGURAÇÃO DE CORS (Aumenta a segurança e evita o ERR_CONNECTION_REFUSED)
app.use(cors());

// 2. AUMENTO DO LIMITE DE PAYLOAD (Necessário para uploads de fotos no Render)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 3. CAMINHO DA PASTA DE UPLOADS (Unificado para funcionar em Local e Render)
const uploadDir = path.resolve("uploads");

// Cria a pasta de uploads automaticamente se ela não existir
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Pasta de uploads pronta!');
}

// 4. ROTAS DA API
app.use("/api/users", usersRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/participations", participationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 5. SERVIR ARQUIVOS ESTÁTICOS (Crucial para a foto aparecer no navegador)
app.use("/uploads", express.static(uploadDir));

// Conectar ao banco
connectDB();

app.get("/", (req, res) => {
  res.send("API do MVP rodando e conectada ao MongoDB!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));