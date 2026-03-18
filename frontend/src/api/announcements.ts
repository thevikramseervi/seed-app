import api from './axios';
import { Announcement } from '../types';

export const announcementsApi = {
  getAll: async (): Promise<Announcement[]> => {
    const { data } = await api.get<Announcement[]>('/announcements');
    return data;
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const { data } = await api.get('/announcements/unread-count');
    return data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.post(`/announcements/${id}/mark-read`);
  },

  create: async (announcementData: {
    title: string;
    content: string;
    priority?: string;
    isPinned?: boolean;
    targetAudience?: string;
    expiresAt?: string;
  }): Promise<Announcement> => {
    const { data } = await api.post<Announcement>('/announcements', announcementData);
    return data;
  },

  update: async (
    id: string,
    updateData: Partial<Pick<Announcement, 'title' | 'content' | 'priority' | 'isPinned' | 'targetAudience' | 'expiresAt'>>,
  ): Promise<Announcement> => {
    const { data } = await api.patch<Announcement>(`/announcements/${id}`, updateData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/announcements/${id}`);
  },
};
