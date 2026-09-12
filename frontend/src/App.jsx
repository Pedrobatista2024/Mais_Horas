import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Loading from "./components/ui/Loading";
import { useAuth } from "./context/AuthContext";
import { painelDe } from "./routes/destinos";
import Landing from "./pages/public/Landing";
import PainelLayout from "./components/layout/PainelLayout";
import RotaPrivada from "./routes/RotaPrivada";

// Acesso — Fatia 1
const Entrar = lazy(() => import("./pages/auth/Entrar"));
const CriarConta = lazy(() => import("./pages/auth/CriarConta"));
const EsqueciSenha = lazy(() => import("./pages/auth/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/auth/RedefinirSenha"));
const EmConstrucao = lazy(() => import("./pages/EmConstrucao"));

// Perfil — Fatia 2
const MeuPerfil = lazy(() => import("./pages/perfil/MeuPerfil"));

// Atividades — Fatia 3
const Vitrine = lazy(() => import("./pages/estudante/Vitrine"));
const DetalheAtividade = lazy(() => import("./pages/estudante/DetalheAtividade"));
const MinhasAtividades = lazy(() => import("./pages/ong/MinhasAtividades"));
const FormularioAtividade = lazy(() => import("./pages/ong/FormularioAtividade"));
const GerenciarAtividade = lazy(() => import("./pages/ong/GerenciarAtividade"));

// Inscrições — Fatia 4
const MinhasInscricoes = lazy(() => import("./pages/estudante/MinhasInscricoes"));
const InscricoesDaAtividade = lazy(() =>
  import("./pages/ong/InscricoesDaAtividade"));

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

/** Área logada: exige sessão e, quando informado, um papel. */
function Area({ papel }) {
  return (
    <RotaPrivada papel={papel}>
      <PainelLayout />
    </RotaPrivada>
  );
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

          {/* Qualquer papel */}
          <Route element={<Area />}>
            <Route path="/perfil" element={<MeuPerfil />} />
          </Route>

          {/* Estudante */}
          <Route element={<Area papel="estudante" />}>
            <Route path="/painel" element={<EmConstrucao />} />
            <Route path="/atividades" element={<Vitrine />} />
            <Route path="/atividades/:id" element={<DetalheAtividade />} />
            <Route path="/minhas-inscricoes" element={<MinhasInscricoes />} />
          </Route>

          {/* Organização */}
          <Route element={<Area papel="ong" />}>
            <Route path="/ong" element={<EmConstrucao />} />
            <Route path="/ong/atividades" element={<MinhasAtividades />} />
            <Route path="/ong/atividades/nova" element={<FormularioAtividade />} />
            <Route path="/ong/atividades/:id" element={<GerenciarAtividade />} />
            <Route path="/ong/atividades/:id/editar" element={<FormularioAtividade />} />
            <Route path="/ong/atividades/:id/inscricoes"
                   element={<InscricoesDaAtividade />} />
          </Route>

          {/* Administração */}
          <Route element={<Area papel="superadmin" />}>
            <Route path="/admin" element={<EmConstrucao />} />
          </Route>

          {/* Endereços da versão anterior continuam levando a algum lugar */}
          <Route path="/login" element={<Navigate to="/entrar" replace />} />
          <Route path="/register" element={<Navigate to="/criar-conta" replace />} />
          <Route path="/dashboard" element={<Navigate to="/painel" replace />} />
          <Route path="/activities" element={<Navigate to="/atividades" replace />} />
          <Route path="/my-activities"
                 element={<Navigate to="/minhas-inscricoes" replace />} />
          <Route path="/org/my-activities" element={<Navigate to="/ong/atividades" replace />} />
          <Route path="/org/create-activity"
                 element={<Navigate to="/ong/atividades/nova" replace />} />
          <Route path="/edit-student-profile" element={<Navigate to="/perfil" replace />} />
          <Route path="/org/profile" element={<Navigate to="/perfil" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
