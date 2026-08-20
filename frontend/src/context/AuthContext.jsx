import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, refreshSession, setAccessToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // O access token fica em memória (ver comentário em services/api.js).
  // Só o usuário é espelhado no localStorage, para a tela pintar sem piscar
  // enquanto a sessão é restaurada.
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    setToken(null);
    setUser(null);
  }, []);

  // Limpa a sessão local primeiro para a UI reagir na hora; a revogação no
  // servidor segue em paralelo. Se ela falhar, o refresh token expira sozinho.
  const logout = useCallback(() => {
    clearSession();
    api.post("/users/logout").catch(() => {});
  }, [clearSession]);

  // Restaura a sessão no boot: o cookie httpOnly de refresh, se ainda válido,
  // devolve um access token novo sem pedir login de novo.
  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const data = await refreshSession();
        if (!active) return;

        setToken(data.token);
        if (data.user) {
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        }

        // Busca o perfil completo (o refresh devolve só o resumo).
        try {
          const { data: profile } = await api.get("/users/profile");
          if (active && profile?.user) {
            setUser(profile.user);
            localStorage.setItem("user", JSON.stringify(profile.user));
          }
        } catch {
          // Perfil é complemento; a sessão em si já está de pé.
        }
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    }

    restore();
    return () => {
      active = false;
    };
  }, [clearSession]);

  // O interceptor avisa quando o refresh falhou de vez.
  useEffect(() => {
    function onExpired() {
      clearSession();
    }
    window.addEventListener("mh:session-expired", onExpired);
    return () => window.removeEventListener("mh:session-expired", onExpired);
  }, [clearSession]);

  const login = useCallback((data) => {
    setAccessToken(data.token);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("user", JSON.stringify(data.user));
  }, []);

  const setUserData = useCallback((u) => {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, logout, setUserData, isAuthenticated: !!token }}
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
