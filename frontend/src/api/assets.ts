import api from './axios';
import { Asset, AssetHistory } from '../types';

export interface AssetHistoryFilters {
  userId?: string;
  assetType?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const assetsApi = {
  getAll: async (userId?: string): Promise<Asset[]> => {
    const { data } = await api.get('/assets', { params: userId ? { userId } : undefined });
    return data;
  },

  getMy: async (): Promise<Asset[]> => {
    const { data } = await api.get<Asset[]>('/assets/my');
    return data;
  },

  createMy: async (payload: { assetType: string; assetNumber: string; serialNumber?: string }): Promise<Asset> => {
    const { data } = await api.post<Asset>('/assets/my', payload);
    return data;
  },

  updateMy: async (id: string, payload: { assetNumber?: string; serialNumber?: string | null }): Promise<Asset> => {
    const { data } = await api.patch<Asset>(`/assets/my/${id}`, payload);
    return data;
  },

  getOne: async (id: string): Promise<Asset> => {
    const { data } = await api.get<Asset>(`/assets/${id}`);
    return data;
  },

  create: async (payload: {
    assetName: string;
    assetType: string;
    assetNumber: string;
    serialNumber?: string;
    userId?: string;
  }): Promise<Asset> => {
    const { data } = await api.post<Asset>('/assets', payload);
    return data;
  },

  update: async (id: string, payload: Partial<{
    assetName: string;
    assetType: string;
    assetNumber: string;
    serialNumber: string;
    userId: string | null;
  }>): Promise<Asset> => {
    const { data } = await api.patch<Asset>(`/assets/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/assets/${id}`);
  },

  getReferenceList: async (): Promise<{ laptops: string[]; monitors: string[] }> => {
    const { data } = await api.get('/assets/reference-list');
    return data;
  },

  getHistory: async (filters?: AssetHistoryFilters): Promise<AssetHistory[]> => {
    const { data } = await api.get<AssetHistory[]>('/assets/history', { params: filters });
    return data;
  },

  getEmployeeHistory: async (userId: string): Promise<AssetHistory[]> => {
    const { data } = await api.get<AssetHistory[]>(`/assets/history/employee/${userId}`);
    return data;
  },

  getMyHistory: async (): Promise<AssetHistory[]> => {
    const { data } = await api.get<AssetHistory[]>('/assets/my-history');
    return data;
  },
};
