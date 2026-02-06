const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://mais-horas.onrender.com";

export default API_BASE_URL;
