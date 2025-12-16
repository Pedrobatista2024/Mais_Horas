import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./src/config/database.js";
import usersRoutes from "./src/routes/users.routes.js";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", usersRoutes);

// Conectar ao banco
connectDB();

app.get("/", (req, res) => {
  res.send("API do MVP rodando e conectada ao MongoDB!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
