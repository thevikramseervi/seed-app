import api from './axios';
import { Holiday } from '../types';

export const holidaysApi = {
  getAll: async (): Promise<Holiday[]> => {
    const { data } = await api.get<Holiday[]>('/holidays');
    return data;
  },

  create: async (holidayData: {
    date: string;
    name: string;
    description?: string;
  }): Promise<Holiday> => {
    const { data } = await api.post<Holiday>('/holidays', holidayData);
    return data;
  },

  update: async (id: string, updateData: Partial<Holiday>): Promise<Holiday> => {
    const { data } = await api.patch<Holiday>(`/holidays/${id}`, updateData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/holidays/${id}`);
  },
};
