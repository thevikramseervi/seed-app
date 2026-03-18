import api from './axios';
import { ActivityEntry } from '../types';

export interface ActivityFilters {
  userId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  project?: string;
}

export interface CreateActivityPayload {
  userId?: string;
  date: string;
  userType?: string;
  project: string;
  task: string;
  subTask?: string;
  unit: string;
  nos: number;
  percentage: number;
  productivity: number;
  weightage: number;
}

export type UpdateActivityPayload = Partial<CreateActivityPayload>;

export const activityApi = {
  create: async (payload: CreateActivityPayload): Promise<ActivityEntry> => {
    const { data } = await api.post<ActivityEntry>('/activity', payload);
    return data;
  },

  update: async (id: string, payload: UpdateActivityPayload): Promise<ActivityEntry> => {
    const { data } = await api.patch<ActivityEntry>(`/activity/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/activity/${id}`);
  },

  getMy: async (params?: { date?: string; startDate?: string; endDate?: string }): Promise<ActivityEntry[]> => {
    const { data } = await api.get<ActivityEntry[]>('/activity/my', { params });
    return data;
  },

  getReport: async (params?: ActivityFilters): Promise<ActivityEntry[]> => {
    const { data } = await api.get<ActivityEntry[]>('/activity', { params });
    return data;
  },
};

