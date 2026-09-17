import { useEffect } from "react";
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
  const { autenticado, usuario, carregando, retorno, limparRetorno } = useAuth();
  const local = useLocation();
  const chegou = retorno && local.pathname === retorno;

  useEffect(() => {
    if (chegou) limparRetorno();
  }, [chegou, limparRetorno]);

  if (carregando) return <Loading label="Verificando sessão..." />;

  if (!autenticado) {
    return <Navigate to="/entrar" state={{ de: local }} replace />;
  }

  // Saída do "entrar como": leva o admin de volta à conta que ele via.
  if (retorno && !chegou) return <Navigate to={retorno} replace />;

  if (papel && usuario?.papel !== papel) {
    return <Navigate to={painelDe(usuario?.papel)} replace />;
  }

  return children;
}
