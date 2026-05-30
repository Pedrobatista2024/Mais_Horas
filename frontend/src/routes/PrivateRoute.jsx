import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/ui/Loading";

/**
 * Protege rotas autenticadas. Opcionalmente exige um papel (role).
 * Se o papel não bate, manda o usuário para o painel correto.
 */
export default function PrivateRoute({ children, role }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Verificando sessão..." />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user?.role !== role) {
    const home = user?.role === "organization" ? "/org" : "/dashboard";
    return <Navigate to={home} replace />;
  }

  return children;
}
