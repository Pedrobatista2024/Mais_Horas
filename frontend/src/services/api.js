import axios from "axios";

// Em prod (Render), defina VITE_API_URL=https://mais-horas-api.onrender.com
// Em dev local, deixa cair no fallback (http://localhost:3000)
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const API_BASE_URL = `${BASE.replace(/\/$/, "")}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const API_URL = API_BASE_URL;
export { api };
