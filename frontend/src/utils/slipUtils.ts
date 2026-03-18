const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULT_PAY_DAY = 10;

export function getPayPeriod(month: number, year: number): string {
  const m = month >= 1 && month <= 12 ? month - 1 : 0;
  const y = year >= 100 ? year % 100 : year;
  return `${MONTH_SHORT[m]}-${String(y).padStart(2, '0')}`;
}

export function getPayDateFormatted(
  month: number,
  year: number,
  paymentDate: string | Date | null | undefined
): string {
  let date: Date;
  if (paymentDate && !isNaN(new Date(paymentDate).getTime())) {
    date = new Date(paymentDate);
  } else {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    const day = Math.min(DEFAULT_PAY_DAY, lastDay);
    date = new Date(Date.UTC(nextYear, nextMonth - 1, day));
  }
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear();
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

function words0To99(n: number): string {
  if (n === 0) return '';
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`.trim();
}

function words0To999(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundredPart = h > 0 ? `${ONES[h]} hundred` : '';
  const restPart = words0To99(rest);
  return restPart ? `${hundredPart} ${restPart}`.trim() : hundredPart;
}

export function numberToWordsInr(amount: number): string {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return 'Rupees Zero only';
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  const parts: string[] = [];
  if (crore > 0) parts.push(`${words0To999(crore)} crore`);
  if (lakh > 0) parts.push(`${words0To999(lakh)} lakh`);
  if (thousand > 0) parts.push(`${words0To999(thousand)} thousand`);
  if (rest > 0) parts.push(words0To999(rest));
  return `Rupees ${parts.join(' ').trim()} only`;
}

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1] ?? '';
}
