/**
 * Carga horária. É a única coisa da interface pintada de âmbar — a cor do
 * ponteiro do relógio no logotipo —, então o olho aprende a achar as horas.
 */
export default function Horas({ valor, sufixo = "h", className = "", ...props }) {
  if (valor === null || valor === undefined) return null;
  const extenso = `${valor} ${valor === 1 ? "hora" : "horas"}`;
  return (
    <span className={`mh-horas ${className}`.trim()} aria-label={extenso}
          title={extenso} {...props}>
      {valor}&nbsp;{sufixo}
    </span>
  );
}
