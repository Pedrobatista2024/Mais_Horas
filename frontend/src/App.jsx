import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Loading from "./components/ui/Loading";
import { useAuth } from "./context/AuthContext";
import { painelDe } from "./routes/destinos";
import PainelLayout from "./components/layout/PainelLayout";
import PortalLayout from "./components/layout/PortalLayout";
import ConteudoDoPortal from "./components/portal/ConteudoDoPortal";
import InicioDoPortal from "./pages/portal/Inicio";
import RotaPrivada from "./routes/RotaPrivada";

// Acesso — Fatia 1
const Entrar = lazy(() => import("./pages/auth/Entrar"));
const CriarConta = lazy(() => import("./pages/auth/CriarConta"));
const EsqueciSenha = lazy(() => import("./pages/auth/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/auth/RedefinirSenha"));

// Painéis — Fatia 10
const PainelEstudante = lazy(() => import("./pages/estudante/Painel"));
const PainelOng = lazy(() => import("./pages/ong/Painel"));

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

// Presença e check-in — Fatia 5
const Checkin = lazy(() => import("./pages/estudante/Checkin"));
const PainelCheckin = lazy(() => import("./pages/ong/PainelCheckin"));
const ValidarPresencas = lazy(() => import("./pages/ong/ValidarPresencas"));

// Certificado — Fatia 6
const MeusCertificados = lazy(() => import("./pages/estudante/MeusCertificados"));
const VerificarCertificado = lazy(() =>
  import("./pages/public/VerificarCertificado"));

// Notificações — Fatia 7
const Notificacoes = lazy(() => import("./pages/Notificacoes"));

// Portal — Fatia 9
const ComoFunciona = lazy(() => import("./pages/portal/ComoFunciona"));
const ParaEstudantes = lazy(() => import("./pages/portal/ParaEstudantes"));
const ParaOngs = lazy(() => import("./pages/portal/ParaOngs"));
const OngsParceiras = lazy(() => import("./pages/portal/OngsParceiras"));
const PerfilOng = lazy(() => import("./pages/portal/PerfilOng"));

// Console administrativo — Fatia 8
const AdminVisaoGeral = lazy(() => import("./pages/admin/VisaoGeral"));
const AdminAuditoria = lazy(() => import("./pages/admin/Auditoria"));
const AdminUsuarios = lazy(() => import("./pages/admin/Usuarios"));
const AdminDetalheUsuario = lazy(() => import("./pages/admin/DetalheUsuario"));
const AdminOngs = lazy(() => import("./pages/admin/Ongs"));
const AdminAtividades = lazy(() => import("./pages/admin/Atividades"));
const AdminCertificados = lazy(() => import("./pages/admin/Certificados"));
const AdminSistema = lazy(() => import("./pages/admin/Sistema"));

/** Rotas por zona (docs/especificacao.md, seção 6). */
function Inicio() {
  const { autenticado, usuario } = useAuth();
  if (autenticado) {
    return <Navigate to={painelDe(usuario?.papel)} replace />;
  }
  return <InicioDoPortal />;
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
          <Route element={<PortalLayout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/para-estudantes" element={<ParaEstudantes />} />
            <Route path="/para-ongs" element={<ParaOngs />} />
            <Route path="/ongs" element={<OngsParceiras />} />
            <Route path="/ongs/:id" element={<PerfilOng />} />
            <Route path="/vagas" element={
              <ConteudoDoPortal><Vitrine base="/vagas" /></ConteudoDoPortal>} />
            <Route path="/vagas/:id" element={
              <ConteudoDoPortal tamanho="lg"><DetalheAtividade base="/vagas" /></ConteudoDoPortal>} />
          </Route>

          <Route path="/entrar" element={<Entrar />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          {/* Destino do QR do certificado: nunca exige login */}
          <Route path="/verificar" element={<VerificarCertificado />} />
          <Route path="/verificar/:codigo" element={<VerificarCertificado />} />

          {/* Qualquer papel */}
          <Route element={<Area />}>
            <Route path="/perfil" element={<MeuPerfil />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
          </Route>

          {/* Estudante */}
          <Route element={<Area papel="estudante" />}>
            <Route path="/painel" element={<PainelEstudante />} />
            <Route path="/atividades" element={<Vitrine />} />
            <Route path="/atividades/:id" element={<DetalheAtividade />} />
            <Route path="/minhas-inscricoes" element={<MinhasInscricoes />} />
            <Route path="/check-in" element={<Checkin />} />
            <Route path="/meus-certificados" element={<MeusCertificados />} />
          </Route>

          {/* Organização */}
          <Route element={<Area papel="ong" />}>
            <Route path="/ong" element={<PainelOng />} />
            <Route path="/ong/atividades" element={<MinhasAtividades />} />
            <Route path="/ong/atividades/nova" element={<FormularioAtividade />} />
            <Route path="/ong/atividades/:id" element={<GerenciarAtividade />} />
            <Route path="/ong/atividades/:id/editar" element={<FormularioAtividade />} />
            <Route path="/ong/atividades/:id/inscricoes"
                   element={<InscricoesDaAtividade />} />
            <Route path="/ong/atividades/:id/check-in" element={<PainelCheckin />} />
            <Route path="/ong/atividades/:id/presencas"
                   element={<ValidarPresencas />} />
          </Route>

          {/* Administração */}
          <Route element={<Area papel="superadmin" />}>
            <Route path="/admin" element={<AdminVisaoGeral />} />
            <Route path="/admin/auditoria" element={<AdminAuditoria />} />
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/admin/usuarios/:id" element={<AdminDetalheUsuario />} />
            <Route path="/admin/ongs" element={<AdminOngs />} />
            <Route path="/admin/atividades" element={<AdminAtividades />} />
            <Route path="/admin/certificados" element={<AdminCertificados />} />
            <Route path="/admin/sistema" element={<AdminSistema />} />
          </Route>

          {/* Endereços da versão anterior continuam levando a algum lugar */}
          <Route path="/login" element={<Navigate to="/entrar" replace />} />
          <Route path="/register" element={<Navigate to="/criar-conta" replace />} />
          <Route path="/dashboard" element={<Navigate to="/painel" replace />} />
          <Route path="/activities" element={<Navigate to="/atividades" replace />} />
          <Route path="/my-certificates"
                 element={<Navigate to="/meus-certificados" replace />} />
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
