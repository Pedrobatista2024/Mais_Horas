import axios from "axios";

// Em prod (Render), defina VITE_API_URL=https://mais-horas-api.onrender.com
// Em dev local, deixa cair no fallback (http://localhost:3000)
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const API_BASE_URL = `${BASE.replace(/\/$/, "")}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Necessário para o cookie httpOnly do refresh token viajar junto.
  withCredentials: true,
});

/**
 * O access token vive só em memória, nunca no localStorage.
 *
 * Isso é o que impede um XSS de roubar a sessão: mesmo que um script hostil rode
 * na página, ele não acha o token em lugar nenhum que possa ler. A renovação
 * depende do cookie httpOnly, que o JavaScript também não enxerga.
 *
 * O custo é que um F5 perde o token da memória — por isso o AuthContext chama
 * refresh() ao montar, e a sessão volta sozinha.
 */
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ===== Renovação de sessão =====
//
// TODA renovação passa por aqui, e só uma pode estar em voo por vez.
//
// Isso não é só otimização: o backend rotaciona o refresh token e trata
// reapresentação como possível roubo. Se dois refresh saíssem em paralelo, o
// segundo chegaria com o cookie já consumido e derrubaria a sessão. O
// AuthContext e o interceptor abaixo compartilham esta mesma promessa.
let refreshing = null;

export function refreshSession() {
  if (!refreshing) {
    refreshing = api
      .post("/users/refresh")
      .then(({ data }) => {
        setAccessToken(data.token);
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// Rotas de sessão não devem entrar no ciclo de retry.
const AUTH_PATHS = ["/users/login", "/users/register", "/users/refresh", "/users/logout"];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (
      !response ||
      response.status !== 401 ||
      !config ||
      config._retried ||
      AUTH_PATHS.some((path) => config.url?.startsWith(path))
    ) {
      return Promise.reject(error);
    }

    config._retried = true;

    let token = null;
    try {
      const data = await refreshSession();
      token = data.token;
    } catch {
      // A sessão morreu de vez — avisa quem estiver ouvindo (AuthContext).
      window.dispatchEvent(new CustomEvent("mh:session-expired"));
      return Promise.reject(error);
    }

    if (!token) return Promise.reject(error);

    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  }
);

export const API_URL = API_BASE_URL;
export { api };
