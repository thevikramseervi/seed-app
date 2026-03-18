/**
 * Company and slip branding for salary slip PDF/Excel.
 * Override via env: COMPANY_NAME, COMPANY_DIVISION, COMPANY_ADDRESS, CURRENCY_NOTE, DEFAULT_PAY_DAY
 */

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const companyName =
  process.env.COMPANY_NAME || 'Cambridge Institute of Technology';
export const division =
  process.env.COMPANY_DIVISION || 'Samsung Seedlab Division';
export const address =
  process.env.COMPANY_ADDRESS ||
  'Jai Bhuvaneswari Lay out, K R Puram, BANGALORE 560 036 - INDIA';
export const currencyNote =
  process.env.CURRENCY_NOTE || 'Figures are in INR';
export const defaultPayDayOfMonth = parseInt(
  process.env.DEFAULT_PAY_DAY || '10',
  10
);

/**
 * Pay period string e.g. "Jun-25"
 */
export function getPayPeriod(month: number, year: number): string {
  const m = month >= 1 && month <= 12 ? month - 1 : 0;
  const y = year >= 100 ? year % 100 : year;
  return `${MONTH_SHORT[m]}-${String(y).padStart(2, '0')}`;
}

/**
 * Pay date: use given date if set, else default to Nth day of month following payroll month.
 * Returns DD-MM-YYYY
 */
export function getPayDateFormatted(
  month: number,
  year: number,
  paymentDate: Date | null | undefined
): string {
  let date: Date;
  if (paymentDate && !isNaN(new Date(paymentDate).getTime())) {
    date = new Date(paymentDate);
  } else {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const day = Math.min(
      defaultPayDayOfMonth,
      new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate()
    );
    date = new Date(Date.UTC(nextYear, nextMonth - 1, day));
  }
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear();
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}
