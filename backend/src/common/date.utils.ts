/**
 * Shared date helpers for attendance and payroll.
 * Weekend = Saturday (6) and Sunday (0).
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/** YYYY-MM-DD for timezone-safe date-only comparison. */
export function toDateOnlyKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
