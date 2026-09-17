import axios from "axios";

// Em produção, defina VITE_API_URL=https://mais-horas-api.onrender.com
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const API_URL = `${BASE.replace(/\/$/, "")}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Necessário para o cookie httpOnly do refresh viajar junto.
  withCredentials: true,
});

/**
 * O access token vive só em memória, nunca no localStorage.
 *
 * É isso que impede um XSS de roubar a sessão: mesmo que um script hostil rode
 * na página, não há onde ler o token. A renovação depende do cookie httpOnly,
 * que o JavaScript também não enxerga.
 *
 * O custo é que um F5 perde o token — por isso o AuthContext chama
 * restaurarSessao() ao montar, e a sessão volta sozinha.
 */
let accessToken = null;

export function definirToken(token) {
  accessToken = token || null;
}

export function obterToken() {
  return accessToken;
}

/**
 * Modo "entrar como" (D13): o token em memória é o do **alvo**, somente
 * leitura e sem refresh.
 *
 * Duas consequências aqui:
 * - escrita é barrada já no cliente, com a mesma resposta que a API daria —
 *   a API também barra, isto só evita a ida e a volta;
 * - um 401 **não** dispara renovação: o cookie é do admin, e renovar trocaria
 *   o token em silêncio enquanto a tela ainda acha que está no espelho.
 */
let modoEspelho = false;
const METODOS_DE_LEITURA = ["get", "head", "options"];
const SAIDA_DO_ESPELHO = "/admin/sair-do-modo";

export function definirEspelho(ativo) {
  modoEspelho = Boolean(ativo);
}

export function emModoEspelho() {
  return modoEspelho;
}

function recusaSomenteLeitura(config) {
  const erro = new Error("Modo somente leitura");
  erro.config = config;
  erro.response = {
    status: 403,
    data: {
      codigo: "modo_somente_leitura",
      mensagem: "Modo somente leitura: no \"entrar como\" nada pode ser alterado.",
    },
  };
  return erro;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  const metodo = (config.method || "get").toLowerCase();
  if (modoEspelho && !METODOS_DE_LEITURA.includes(metodo)
      && config.url !== SAIDA_DO_ESPELHO) {
    return Promise.reject(recusaSomenteLeitura(config));
  }
  return config;
});

// ===== Renovação de sessão =====
//
// TODA renovação passa por aqui, e só uma pode estar em voo por vez.
//
// Não é otimização: o servidor rotaciona o refresh e trata reapresentação como
// possível roubo. Dois refresh em paralelo fariam o segundo chegar com o cookie
// já consumido. O backend tolera a corrida por 15 s, mas depender disso seria
// frágil — melhor nunca provocá-la.
let renovando = null;

export function renovarSessao() {
  if (!renovando) {
    renovando = api
      .post("/auth/renovar")
      .then(({ data }) => {
        definirToken(data.token);
        return data;
      })
      .finally(() => {
        renovando = null;
      });
  }
  return renovando;
}

// Rotas de sessão não entram no ciclo de repetição.
const ROTAS_DE_SESSAO = [
  "/auth/entrar",
  "/auth/cadastro",
  "/auth/renovar",
  "/auth/sair",
  "/auth/senha",
];

api.interceptors.response.use(
  (resposta) => resposta,
  async (erro) => {
    const { config, response } = erro;

    if (modoEspelho && response?.status === 401) {
      window.dispatchEvent(new CustomEvent("mh:espelho-encerrado"));
      return Promise.reject(erro);
    }

    if (
      !response ||
      response.status !== 401 ||
      !config ||
      config._repetida ||
      ROTAS_DE_SESSAO.some((rota) => config.url?.startsWith(rota))
    ) {
      return Promise.reject(erro);
    }

    config._repetida = true;

    let token = null;
    try {
      ({ token } = await renovarSessao());
    } catch {
      // A sessão morreu de vez — avisa quem estiver ouvindo (AuthContext).
      window.dispatchEvent(new CustomEvent("mh:sessao-expirada"));
      return Promise.reject(erro);
    }

    if (!token) return Promise.reject(erro);

    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  }
);

/**
 * Extrai a mensagem de um erro da API.
 *
 * O backend responde `{ codigo, mensagem, detalhes? }`. O `codigo` é estável e
 * deve guiar decisões de lógica; a `mensagem` serve para exibir.
 */
export function mensagemDoErro(erro, padrao = "Algo deu errado") {
  const dados = erro?.response?.data;
  if (!dados) return erro?.message || padrao;
  if (Array.isArray(dados.detalhes) && dados.detalhes.length) {
    return dados.detalhes.map((d) => d.mensagem).join(". ");
  }
  return dados.mensagem || padrao;
}

/** Código estável do erro, para o cliente decidir o que fazer. */
export function codigoDoErro(erro) {
  return erro?.response?.data?.codigo || null;
}

export { api };
