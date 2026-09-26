import { Button } from "@mantine/core";
import { useNavigate } from "react-router-dom";

import WelcomeBanner from "../ui/WelcomeBanner";

/**
 * A faixa do topo dos painéis: mostra a ação mais urgente que o servidor
 * escolheu. Tipo desconhecido cai no "nenhum" — painel sem faixa seria pior
 * que uma faixa genérica.
 */
export default function Destaque({ destaque, catalogo, eyebrow }) {
  const navegar = useNavigate();
  const modelo = catalogo[destaque?.tipo] ?? catalogo.nenhum;

  return (
    <WelcomeBanner
      eyebrow={eyebrow}
      icon={modelo.icone}
      title={destaque?.titulo ?? ""}
      subtitle={destaque?.mensagem}
      action={
        <Button size="md" color={modelo.cor} variant="white"
                onClick={() => navegar(modelo.destino(destaque))}>
          {modelo.rotulo}
        </Button>
      }
    />
  );
}
