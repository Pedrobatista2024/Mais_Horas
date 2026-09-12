import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Loading from "./components/ui/Loading";
import { useAuth } from "./context/AuthContext";
import { painelDe } from "./routes/destinos";
import Landing from "./pages/public/Landing";
import RotaPrivada from "./routes/RotaPrivada";

// Acesso — Fatia 1
const Entrar = lazy(() => import("./pages/auth/Entrar"));
const CriarConta = lazy(() => import("./pages/auth/CriarConta"));
const EsqueciSenha = lazy(() => import("./pages/auth/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/auth/RedefinirSenha"));
const EmConstrucao = lazy(() => import("./pages/EmConstrucao"));

/**
 * As rotas entram fatia a fatia (docs/plano-execucao.md). As telas das fatias
 * seguintes ainda não estão listadas aqui porque chamariam endpoints que não
 * existem — melhor ausentes que quebradas.
 */
function Inicio() {
  const { autenticado, usuario } = useAuth();
  if (autenticado) {
    return <Navigate to={painelDe(usuario?.papel)} replace />;
  }
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading label="Carregando..." />}>
        <Routes>
          {/* Portal — público */}
          <Route path="/" element={<Inicio />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />

          {/* Painéis — provisórios até as fatias correspondentes */}
          <Route
            path="/painel"
            element={
              <RotaPrivada papel="estudante">
                <EmConstrucao />
              </RotaPrivada>
            }
          />
          <Route
            path="/ong"
            element={
              <RotaPrivada papel="ong">
                <EmConstrucao />
              </RotaPrivada>
            }
          />
          <Route
            path="/admin"
            element={
              <RotaPrivada papel="superadmin">
                <EmConstrucao />
              </RotaPrivada>
            }
          />

          {/* Endereços da versão anterior continuam levando a algum lugar */}
          <Route path="/login" element={<Navigate to="/entrar" replace />} />
          <Route path="/register" element={<Navigate to="/criar-conta" replace />} />
          <Route path="/dashboard" element={<Navigate to="/painel" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
