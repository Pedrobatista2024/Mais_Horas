/**
 * Glyph de relógio para substituir o "o" da palavra "Horas" no logotipo.
 * Mostrador claro, aro com gradiente azul, 12 marcadores, ponteiros na pose
 * clássica de relógio (10:10) e um ponteiro de segundos âmbar — leitura de
 * relógio real, não de ícone genérico.
 */
export default function ClockGlyph({ size = 28, style, idSuffix = "a" }) {
  const ring = `mhClockRing-${idSuffix}`;

  // 12 marcadores ao redor do mostrador
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const ang = (i * 30 * Math.PI) / 180;
    const isHour = i % 3 === 0;
    const rOut = 33;
    const rIn = isHour ? 26 : 29;
    const x1 = 50 + rOut * Math.sin(ang);
    const y1 = 50 - rOut * Math.cos(ang);
    const x2 = 50 + rIn * Math.sin(ang);
    const y2 = 50 - rIn * Math.cos(ang);
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isHour ? "#142f8f" : "#9fb1d6"}
        strokeWidth={isHour ? 3.2 : 1.8}
        strokeLinecap="round"
      />
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="o"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id={ring} x1="12" y1="8" x2="88" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a63e0" />
          <stop offset="1" stopColor="#142f8f" />
        </linearGradient>
      </defs>

      {/* aro externo */}
      <circle cx="50" cy="50" r="47" fill={`url(#${ring})`} />
      {/* bisel interno */}
      <circle cx="50" cy="50" r="40" fill="#eef2fb" />
      {/* mostrador */}
      <circle cx="50" cy="50" r="37" fill="#ffffff" />

      {ticks}

      {/* ponteiro de segundos (âmbar) — 6h, com contrapeso */}
      <line x1="50" y1="50" x2="50" y2="80" stroke="#ef9504" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="50" y1="50" x2="50" y2="42" stroke="#ef9504" strokeWidth="1.6" strokeLinecap="round" />

      {/* ponteiro das horas → 10h */}
      <line x1="50" y1="50" x2="32.8" y2="37.9" stroke="#142f8f" strokeWidth="5.2" strokeLinecap="round" />
      {/* ponteiro dos minutos → 2 (pose 10:10) */}
      <line x1="50" y1="50" x2="76" y2="35" stroke="#1f47c9" strokeWidth="4.4" strokeLinecap="round" />

      {/* pino central */}
      <circle cx="50" cy="50" r="3.6" fill="#142f8f" />
      <circle cx="50" cy="50" r="1.5" fill="#ffffff" />
    </svg>
  );
}
