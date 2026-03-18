import { AttendanceStatus } from '@prisma/client';
import { getStatusFromWorkDurationMinutes } from './attendance.utils';

describe('getStatusFromWorkDurationMinutes', () => {
  it('returns PRESENT for >= 8h 30m', () => {
    expect(getStatusFromWorkDurationMinutes(8 * 60 + 30)).toBe(AttendanceStatus.PRESENT);
    expect(getStatusFromWorkDurationMinutes(10 * 60)).toBe(AttendanceStatus.PRESENT);
  });

  it('returns HALF_DAY for >= 3h 45m and < 8h 30m', () => {
    expect(getStatusFromWorkDurationMinutes(3 * 60 + 45)).toBe(AttendanceStatus.HALF_DAY);
    expect(getStatusFromWorkDurationMinutes(8 * 60 + 29)).toBe(AttendanceStatus.HALF_DAY);
  });

  it('returns ABSENT for < 3h 45m', () => {
    expect(getStatusFromWorkDurationMinutes(0)).toBe(AttendanceStatus.ABSENT);
    expect(getStatusFromWorkDurationMinutes(3 * 60 + 44)).toBe(AttendanceStatus.ABSENT);
  });
});
