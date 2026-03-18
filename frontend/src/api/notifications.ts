import api from './axios';
import { Notification } from '../types';

export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    const { data } = await api.get<Notification[]>('/notifications');
    return data;
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const { data } = await api.get('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.post(`/notifications/${id}/mark-read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post('/notifications/mark-all-read');
  },
};

