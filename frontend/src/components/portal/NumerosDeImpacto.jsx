import Numeros from "../ui/Numeros";
import { numerosVisiveis } from "./impacto";

/**
 * Impacto em números — só o que o banco confirma.
 *
 * Número zerado não aparece, e sem nenhum número a seção inteira some: vitrine
 * com "0 horas" ou com contagem inventada depõe contra o projeto do mesmo jeito.
 */
export default function NumerosDeImpacto({ resumo }) {
  const visiveis = numerosVisiveis(resumo);
  if (visiveis.length === 0) return null;

  return (
    <Numeros colunas={{ base: 1, xs: 3, md: visiveis.length }}
             itens={visiveis.map(({ chave, rotulo }) => ({
      rotulo: rotulo[1][0].toUpperCase() + rotulo[1].slice(1),
      valor: resumo[chave].toLocaleString("pt-BR"),
    }))} />
  );
}
