import { partesDaData } from "../../utils/format";

/**
 * A data na frente de uma linha de atividade: dia grande, semana e mês
 * pequenos. Em lista de evento a data é o que o olho procura primeiro.
 */
export default function DataBloco({ data }) {
  const partes = partesDaData(data);
  if (!partes) return null;
  return (
    <div className="mh-data" data-hoje={partes.hoje || undefined}
         aria-label={partes.hoje ? "hoje" : `${partes.dia} de ${partes.mes}`}>
      <span className="mh-data-semana" aria-hidden="true">
        {partes.hoje ? "hoje" : partes.semana}
      </span>
      <span className="mh-data-dia" aria-hidden="true">{partes.dia}</span>
      <span className="mh-data-mes" aria-hidden="true">{partes.mes}</span>
    </div>
  );
}
