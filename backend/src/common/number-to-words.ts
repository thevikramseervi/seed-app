/**
 * Convert a number to Indian English words for "Net Payable in words".
 * Handles whole rupees only (no paise). Supports up to crore.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];
const TEENS = [
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

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

/**
 * Convert amount (whole rupees) to Indian English words.
 * e.g. 21267 -> "Twenty One thousand Two hundred Sixty Seven"
 */
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

  const words = parts.join(' ').trim();
  return `Rupees ${words} only`;
}
