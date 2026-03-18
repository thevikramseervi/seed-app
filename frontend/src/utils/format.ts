/** Format a time value (HH:MM string, ISO string, or Date) to HH:MM. */
export const formatTime = (val: string | Date | null | undefined): string => {
  if (!val) return '-';
  try {
    if (typeof val === 'string') {
      // Already HH:MM or HH:MM:SS
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(val)) return val.slice(0, 5);
      // ISO string — use UTC so stored time is shown without TZ shift
      const d = new Date(val);
      if (isNaN(d.getTime())) return '-';
      return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    }
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return '-';
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
  } catch {
    return '-';
  }
};

/** Format duration in minutes as H:MM (e.g. 525 → "8:45"). */
export const formatDuration = (minutes?: number | null): string => {
  if (minutes == null) return '-';
  const total = Number(minutes);
  if (Number.isNaN(total)) return '-';
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Format a numeric value as currency (e.g. INR) with thousands separators. */
export const formatCurrency = (
  value?: number | string | null,
  options?: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
): string => {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';

  const {
    currency = 'INR',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options ?? {};

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(num);
  } catch {
    return num.toFixed(Math.max(minimumFractionDigits, 0));
  }
};
