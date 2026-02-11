//const API_BASE_URL ="https://mais-horas.onrender.com"

const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://mais-horas.onrender.com";

console.log("🌍 Hostname atual:", window.location.hostname);
console.log("🔗 API selecionada:", API_BASE_URL);
export default API_BASE_URL;
