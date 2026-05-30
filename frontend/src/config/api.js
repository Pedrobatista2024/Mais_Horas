// Em prod (Render), defina VITE_API_URL=https://mais-horas-api.onrender.com
// Em dev local, cai no fallback (http://localhost:3000)
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

console.log("🔗 API selecionada:", API_BASE_URL);

export default API_BASE_URL;
