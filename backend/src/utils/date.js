/**
 * Converte "AAAA-MM-DD" para um Date em 12:00 UTC.
 * Usar meio-dia evita o "menos 1 dia" em fusos negativos (ex.: Brasil).
 */
export function parseDateOnlyToUTCNoon(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** true se a data (apenas dia) é anterior a hoje */
export function isPastDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(date);
  cmp.setHours(0, 0, 0, 0);
  return cmp < today;
}
