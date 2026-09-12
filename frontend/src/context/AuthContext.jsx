import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, definirToken, renovarSessao } from "../services/api";

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

  const limparSessao = useCallback(() => {
    definirToken(null);
    localStorage.removeItem("usuario");
    setToken(null);
    setUsuario(null);
  }, []);

  // Restaura a sessão no boot: o cookie httpOnly, se ainda válido, devolve um
  // token novo sem pedir login de novo.
  useEffect(() => {
    let ativo = true;

    renovarSessao()
      .then((dados) => {
        if (!ativo) return;
        setToken(dados.token);
        setUsuario(dados.usuario);
        localStorage.setItem("usuario", JSON.stringify(dados.usuario));
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
  }, [limparSessao]);

  // O interceptor avisa quando a renovação falhou de vez.
  useEffect(() => {
    window.addEventListener("mh:sessao-expirada", limparSessao);
    return () => window.removeEventListener("mh:sessao-expirada", limparSessao);
  }, [limparSessao]);

  const entrar = useCallback((dados) => {
    definirToken(dados.token);
    setToken(dados.token);
    setUsuario(dados.usuario);
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));
  }, []);

  // Limpa o estado local na hora para a interface reagir sem esperar; a
  // revogação no servidor segue em paralelo. Se falhar, o refresh expira só.
  const sair = useCallback(() => {
    limparSessao();
    api.post("/auth/sair").catch(() => {});
  }, [limparSessao]);

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
        entrar,
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
