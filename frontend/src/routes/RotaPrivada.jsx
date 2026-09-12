import { Navigate, useLocation } from "react-router-dom";

import Loading from "../components/ui/Loading";
import { useAuth } from "../context/AuthContext";
import { painelDe } from "./destinos";

/**
 * Protege rotas autenticadas. Opcionalmente exige um papel.
 *
 * Papel errado não é erro: o usuário é levado ao painel dele, sem mensagem de
 * acesso negado — ele não fez nada de errado, só digitou o endereço de outro.
 */
export default function RotaPrivada({ children, papel }) {
  const { autenticado, usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <Loading label="Verificando sessão..." />;

  if (!autenticado) {
    return <Navigate to="/entrar" state={{ de: local }} replace />;
  }

  if (papel && usuario?.papel !== papel) {
    return <Navigate to={painelDe(usuario?.papel)} replace />;
  }

  return children;
}
