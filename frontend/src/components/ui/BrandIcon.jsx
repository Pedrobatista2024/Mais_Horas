/**
 * Símbolo da marca Mais Horas: relógio (horas) + "+" (mais), em azul institucional.
 * Cor cheia — já inclui o badge arredondado.
 */
export default function BrandIcon({ size = 44, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Mais Horas"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="mhBlueIcon" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f57d8" />
          <stop offset="1" stopColor="#142f8f" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="url(#mhBlueIcon)" />
      <circle cx="58" cy="70" r="34" stroke="#FFFFFF" strokeWidth="7" />
      <path d="M58 70V49" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
      <path d="M58 70H75" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
      <circle cx="95" cy="38" r="20" fill="#E09407" stroke="url(#mhBlueIcon)" strokeWidth="6" />
      <path d="M95 29V47M86 38H104" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
