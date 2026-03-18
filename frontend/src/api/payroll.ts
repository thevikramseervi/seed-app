import api from './axios';
import { Payroll } from '../types';

export const payrollApi = {
  getMySalarySlips: async (): Promise<Payroll[]> => {
    const { data } = await api.get<Payroll[]>('/payroll/my-salary-slips');
    return Array.isArray(data) ? data : data ? [data] : [];
  },

  getAll: async (params?: {
    year?: number;
    month?: number;
    userId?: string;
  }): Promise<Payroll[]> => {
    const { data } = await api.get<Payroll[]>('/payroll', { params });
    return Array.isArray(data) ? data : [];
  },

  getById: async (id: string): Promise<Payroll> => {
    const { data } = await api.get<Payroll>(`/payroll/${id}`);
    return data;
  },

  generate: async (generateData: {
    year: number;
    month: number;
    userId?: string;
    paymentDate?: string;
  }): Promise<{ success?: number; failed?: number }> => {
    const { data } = await api.post<{ success?: number; failed?: number }>(
      '/payroll/generate',
      generateData,
    );
    return data;
  },

  markAsPaid: async (id: string): Promise<Payroll> => {
    const { data } = await api.patch<Payroll>(`/payroll/${id}/mark-paid`);
    return data;
  },

  downloadPDF: async (id: string): Promise<void> => {
    const response = await api.get(`/payroll/${id}/download/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salary-slip-${id}.pdf`;
    // Attach to DOM so Firefox triggers the download correctly
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadExcel: async (id: string): Promise<void> => {
    const response = await api.get(`/payroll/${id}/download/xlsx`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salary-slip-${id}.xlsx`;
    // Attach to DOM so Firefox triggers the download correctly
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
