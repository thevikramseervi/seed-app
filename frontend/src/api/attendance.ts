import api from './axios';
import { Attendance, DashboardStats } from '../types';

/** Response shape from GET /attendance/monthly/:year/:month */
export interface MonthlyAttendanceResponse {
  attendance: Attendance[];
  summary: {
    totalDays: number;
    present: number;
    absent: number;
    halfDay: number;
    casualLeave: number;
    weekend: number;
    holiday: number;
  };
}

export const attendanceApi = {
  getMyAttendance: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Attendance[]> => {
    const { data } = await api.get<Attendance[]>('/attendance/my-attendance', { params });
    return data;
  },

  getMonthlyAttendance: async (
    year: number,
    month: number,
  ): Promise<MonthlyAttendanceResponse> => {
    const { data } = await api.get<MonthlyAttendanceResponse>(
      `/attendance/monthly/${year}/${month}`,
    );
    return data;
  },

  getDashboard: async (): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/attendance/dashboard');
    return data;
  },

  /**
   * Admin reporting endpoint: returns attendance records with user details.
   */
  getReport: async (params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<Attendance[]> => {
    const { data } = await api.get<Attendance[]>('/attendance/report', { params });
    return data;
  },

  createManual: async (attendanceData: {
    userId: string;
    date: string;
    status: string;
  }): Promise<Attendance> => {
    const { data } = await api.post<Attendance>('/attendance/manual', attendanceData);
    return data;
  },

  update: async (id: string, updateData: { status: string }): Promise<Attendance> => {
    const { data } = await api.patch<Attendance>(`/attendance/${id}`, updateData);
    return data;
  },
};
