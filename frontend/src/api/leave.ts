import api from './axios';
import { LeaveApplication, LeaveBalance, ClUsageSummary } from '../types';

export const leaveApi = {
  apply: async (leaveData: {
    fromDate: string;
    toDate: string;
    reason: string;
    leaveType: 'CASUAL_LEAVE' | 'UNPAID_LEAVE';
  }): Promise<LeaveApplication> => {
    const { data } = await api.post<LeaveApplication>('/leave/apply', leaveData);
    return data;
  },

  getMyApplications: async (): Promise<LeaveApplication[]> => {
    const { data } = await api.get<LeaveApplication[]>('/leave/my-applications');
    return data;
  },

  /**
   * Admin reporting endpoint: returns leave applications with user details.
   */
  getReport: async (params?: {
    userId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<LeaveApplication[]> => {
    const { data } = await api.get<LeaveApplication[]>('/leave/report', { params });
    return data;
  },

  getBalance: async (): Promise<LeaveBalance> => {
    const { data } = await api.get<LeaveBalance>('/leave/balance');
    return data;
  },

  getClUsage: async (params?: { userId?: string; year?: number }): Promise<ClUsageSummary> => {
    const { data } = await api.get<ClUsageSummary>('/leave/cl-usage', { params });
    return data;
  },

  getPending: async (): Promise<LeaveApplication[]> => {
    const { data } = await api.get<LeaveApplication[]>('/leave/pending');
    return data;
  },

  approve: async (id: string, comments?: string): Promise<LeaveApplication> => {
    const { data } = await api.patch<LeaveApplication>(`/leave/${id}/approve`, { comments });
    return data;
  },

  reject: async (id: string, comments: string): Promise<LeaveApplication> => {
    const { data } = await api.patch<LeaveApplication>(`/leave/${id}/reject`, { comments });
    return data;
  },

  cancel: async (id: string): Promise<void> => {
    await api.delete(`/leave/${id}`);
  },

  reopen: async (id: string): Promise<LeaveApplication> => {
    const { data } = await api.patch<LeaveApplication>(`/leave/${id}/reopen`);
    return data;
  },
};
