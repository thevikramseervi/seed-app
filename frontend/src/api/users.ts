import api from './axios';
import { User } from '../types';

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

async function getUsersPage(params?: {
  limit?: number;
  page?: number;
}): Promise<PaginatedResponse<User>> {
  const limit = params?.limit ?? 50;
  const page = params?.page ?? 1;
  const { data } = await api.get('/users', { params: { limit, page } });

  if (Array.isArray(data)) {
    return {
      data,
      meta: {
        total: data.length,
        page,
        limit,
        totalPages: 1,
      },
    };
  }

  return {
    data: data.data || [],
    meta: data.meta || {
      total: (data.data || []).length,
      page,
      limit,
      totalPages: 1,
    },
  };
}

export const usersApi = {
  getPage: getUsersPage,

  /** Returns first page only (default limit 50). Use getAllPages() when you need every user. */
  getAll: async (params?: { limit?: number; page?: number }): Promise<User[]> => {
    const result = await getUsersPage(params);
    return result.data;
  },

  /** Fetches all users by requesting all pages. Use for dropdowns that must list every user. */
  getAllPages: async (): Promise<User[]> => {
    const first = await getUsersPage({ page: 1, limit: 100 });
    const total = first.meta?.total ?? first.data.length;
    if (total <= first.data.length) return first.data;
    const pages = Math.ceil(total / 100);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        getUsersPage({ page: i + 2, limit: 100 }).then((r) => r.data)
      )
    );
    return first.data.concat(rest.flat());
  },

  getById: async (id: string): Promise<User> => {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  create: async (userData: {
    employeeId: string;
    employeeNumber: number;
    name: string;
    email: string;
    password: string;
    designation?: string;
    role?: string;
    dateOfJoining: string;
    baseSalary?: number;
  }): Promise<User> => {
    const { data } = await api.post<User>('/users', userData);
    return data;
  },

  update: async (id: string, updateData: Partial<User>): Promise<User> => {
    const { data } = await api.patch<User>(`/users/${id}`, updateData);
    return data;
  },

  deactivate: async (id: string): Promise<User> => {
    const { data } = await api.patch<User>(`/users/${id}/deactivate`);
    return data;
  },

  activate: async (id: string): Promise<User> => {
    const { data } = await api.patch<User>(`/users/${id}/activate`);
    return data;
  },
};
