/**
 * Full-year casual leave entitlement (days per year).
 */
export const FULL_YEAR_CASUAL_LEAVE = 12;

/**
 * Pro-rata casual leave for a given year based on date of joining.
 *
 * Rules (UTC dates throughout):
 * - Joined before the year     → full 12 days.
 * - Joined during the year     → 1 day per eligible month.
 *   Mid-month rule: join on or before the 15th → that month counts;
 *                   join after the 15th         → that month is skipped.
 *   e.g. joining April 10  → Apr–Dec = 9 months → 9 days.
 *        joining April 20  → May–Dec = 8 months → 8 days.
 * - Joining in a future year   → 0.
 */
export function getProRataCasualLeaveForYear(
  dateOfJoining: Date,
  year: number,
): number {
  const joiningYear = dateOfJoining.getUTCFullYear();
  if (joiningYear > year) return 0;
  if (joiningYear < year) return FULL_YEAR_CASUAL_LEAVE;

  // Same year: apply mid-month rule to determine the first eligible month.
  const joiningMonth = dateOfJoining.getUTCMonth(); // 0-based: Jan=0, Dec=11
  const joiningDay   = dateOfJoining.getUTCDate();

  // If joining after the 15th, skip that month and start from the next one.
  const firstEligibleMonth = joiningDay > 15 ? joiningMonth + 1 : joiningMonth;

  // Months from firstEligibleMonth (inclusive) to December (inclusive).
  const monthsEligible = 12 - firstEligibleMonth;
  return Math.max(0, monthsEligible);
}

/**
 * Accrued casual leaves up to a given month in a year (inclusive).
 *
 * Uses the same pro-rata + mid-month rule as the full-year entitlement:
 * - Join after the 15th → accrual starts next month.
 * - Join before the year → accrual starts January.
 *
 * Example: currentMonthIndex=2 (March):
 * - Joined Jan → accrued = 3
 * - Joined Feb 20 → accrual starts Mar → accrued = 1
 */
export function getAccruedCasualLeaveUpToMonth(
  dateOfJoining: Date,
  year: number,
  currentMonthIndex: number, // 0-based month index in UTC
): number {
  const joiningYear = dateOfJoining.getUTCFullYear();
  if (joiningYear > year) return 0;

  const cap = getProRataCasualLeaveForYear(dateOfJoining, year);
  if (cap === 0) return 0;

  let firstEligibleMonth = 0; // Jan
  if (joiningYear === year) {
    const joiningMonth = dateOfJoining.getUTCMonth();
    const joiningDay = dateOfJoining.getUTCDate();
    firstEligibleMonth = joiningDay > 15 ? joiningMonth + 1 : joiningMonth;
  }

  const lastMonth = Math.min(11, Math.max(0, currentMonthIndex));
  if (firstEligibleMonth > lastMonth) return 0;

  const accrued = lastMonth - firstEligibleMonth + 1;
  return Math.min(cap, Math.max(0, accrued));
}
