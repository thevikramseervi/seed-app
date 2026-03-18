import { AttendanceStatus } from '@prisma/client';

/**
 * Maps total work duration (minutes) to attendance status for a working day.
 * Rules:
 * - >= 8h 30m (510 min) = PRESENT
 * - >= 3h 45m (225 min) and < 8h 30m = HALF_DAY
 * - < 3h 45m = ABSENT.
 */
export function getStatusFromWorkDurationMinutes(totalMinutes: number): AttendanceStatus {
  const FULL_DAY_MINUTES = 8 * 60 + 30; // 8h 30m
  const HALF_DAY_MINUTES = 3 * 60 + 45; // 3h 45m

  if (totalMinutes >= FULL_DAY_MINUTES) return AttendanceStatus.PRESENT;
  if (totalMinutes >= HALF_DAY_MINUTES) return AttendanceStatus.HALF_DAY;
  return AttendanceStatus.ABSENT;
}
