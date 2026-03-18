export const QUERY_KEYS = {
  // Auth
  me: ['me'] as const,

  // Users
  users: (page?: number, limit?: number) =>
    page !== undefined ? ['users', page, limit] as const : ['users'] as const,
  usersAll: ['users-all'] as const,
  usersForActivity: ['users-for-activity'] as const,

  // Attendance
  attendanceDashboard: ['dashboard-stats'] as const,
  myAttendanceMonthly: (year: number, month: number) =>
    ['my-attendance-monthly', year, month] as const,
  attendanceReport: (userId?: string, start?: string, end?: string) =>
    ['attendance-report', userId ?? '', start ?? '', end ?? ''] as const,

  // Leave
  myLeaveApplications: ['my-leave-applications'] as const,
  leaveBalance: ['leave-balance'] as const,
  pendingLeaveApplications: ['pending-leave-applications'] as const,
  leaveReport: (userId?: string, from?: string, to?: string) =>
    ['leave-report', userId ?? '', from ?? '', to ?? ''] as const,

  // Payroll / salary slips
  mySalarySlips: ['my-salary-slips'] as const,
  salarySlip: (id: string) => ['salary-slip', id] as const,
  payroll: ['payroll'] as const,
  payrollReport: (year: number, month: number, userId?: string) =>
    ['payroll-report', year, month, userId ?? ''] as const,

  // Holidays
  holidays: ['holidays'] as const,

  // Announcements
  announcements: ['announcements'] as const,

  // Notifications
  notifications: ['notifications'] as const,
  notificationsUnreadCount: ['notifications-unread-count'] as const,

  // Activity
  activities: (scope: 'admin' | 'me', userId: string, date: string) =>
    ['activities', scope, userId, date] as const,
};
