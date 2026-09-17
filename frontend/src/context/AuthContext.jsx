import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, definirEspelho, definirToken, renovarSessao } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // O token fica em memória (ver services/api.js). Só o usuário é espelhado no
  // localStorage, para a tela pintar sem piscar enquanto a sessão é restaurada.
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(() => {
    const bruto = localStorage.getItem("usuario");
    return bruto ? JSON.parse(bruto) : null;
  });
  const [carregando, setCarregando] = useState(true);
  // Modo "entrar como" (D13): { alvo, admin, expiraEm }. Vive só em memória —
  // recarregar a página encerra o espelho e volta à sessão do admin.
  const [espelho, setEspelho] = useState(null);
  // Para onde o admin volta ao sair do espelho. Consumido por RotaPrivada:
  // navegar daqui não serve, porque a troca de usuário já redireciona antes.
  const [retorno, setRetorno] = useState(null);

  const limparSessao = useCallback(() => {
    definirToken(null);
    definirEspelho(false);
    localStorage.removeItem("usuario");
    setToken(null);
    setUsuario(null);
    setEspelho(null);
  }, []);

  const aplicarSessao = useCallback((dados) => {
    setToken(dados.token);
    setUsuario(dados.usuario);
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));
  }, []);

  // Restaura a sessão no boot: o cookie httpOnly, se ainda válido, devolve um
  // token novo sem pedir login de novo.
  useEffect(() => {
    let ativo = true;

    renovarSessao()
      .then((dados) => {
        if (ativo) aplicarSessao(dados);
      })
      .catch(() => {
        if (ativo) limparSessao();
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [aplicarSessao, limparSessao]);

  // O interceptor avisa quando a renovação falhou de vez.
  useEffect(() => {
    window.addEventListener("mh:sessao-expirada", limparSessao);
    return () => window.removeEventListener("mh:sessao-expirada", limparSessao);
  }, [limparSessao]);

  const entrar = useCallback((dados) => {
    definirToken(dados.token);
    aplicarSessao(dados);
  }, [aplicarSessao]);

  /**
   * Troca o token em memória pelo do alvo. O `usuario` do localStorage
   * continua sendo o admin: é ele quem volta se a página recarregar.
   */
  const entrarComo = useCallback((dados) => {
    definirToken(dados.token);
    definirEspelho(true);
    setToken(dados.token);
    setUsuario(dados.usuario);
    setEspelho({ alvo: dados.usuario, admin: dados.admin, expiraEm: dados.expiraEm });
  }, []);

  /**
   * Encerra o espelho e restaura a sessão do admin pelo cookie.
   * `avisarServidor: false` quando o token já expirou — não há o que revogar.
   * `voltarPara` é a tela do admin que abre em seguida.
   */
  const sairDoModo = useCallback(async ({ avisarServidor = true, voltarPara = null } = {}) => {
    if (avisarServidor) {
      await api.post("/admin/sair-do-modo").catch(() => {});
    }
    definirEspelho(false);
    definirToken(null);
    try {
      const dados = await renovarSessao();
      setEspelho(null);
      // No mesmo lote que a troca de usuário: antes dela, a rota de destino
      // ainda veria o papel do alvo e redirecionaria para o painel dele.
      setRetorno(voltarPara);
      aplicarSessao(dados);
    } catch {
      limparSessao();
    }
  }, [aplicarSessao, limparSessao]);

  // Limpa o estado local na hora para a interface reagir sem esperar; a
  // revogação no servidor segue em paralelo. Se falhar, o refresh expira só.
  const sair = useCallback(() => {
    if (espelho) api.post("/admin/sair-do-modo").catch(() => {});
    limparSessao();
    api.post("/auth/sair").catch(() => {});
  }, [espelho, limparSessao]);

  const limparRetorno = useCallback(() => setRetorno(null), []);

  const atualizarUsuario = useCallback((novo) => {
    setUsuario(novo);
    localStorage.setItem("usuario", JSON.stringify(novo));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        usuario,
        carregando,
        espelho,
        retorno,
        limparRetorno,
        entrar,
        entrarComo,
        sairDoModo,
        sair,
        atualizarUsuario,
        autenticado: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
