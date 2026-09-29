import client from './client';

export type MasterTab = { masterType: string; label: string; description: string };
export type MasterItem = { lookupId: number; masterType: string; name: string; description: string | null };

export const getMasterTabs = () => client.get<{ success: boolean; tabs: MasterTab[] }>('/admin/employee-masters/tabs');

export const getMasterItems = (masterType: string, search?: string) =>
  client.get<{ success: boolean; items: MasterItem[] }>('/admin/employee-masters', { params: { masterType, ...(search ? { search } : {}) } });

export const createMasterItem = (payload: { masterType: string; name: string; description?: string }) =>
  client.post<{ success: boolean; item: MasterItem; errors?: string[] }>('/admin/employee-masters', payload);

export const updateMasterItem = (id: number, payload: { name: string; description?: string }) =>
  client.put<{ success: boolean; item: MasterItem; errors?: string[] }>(`/admin/employee-masters/${id}`, payload);

export const deleteMasterItem = (id: number) => client.delete<{ success: boolean; message: string }>(`/admin/employee-masters/${id}`);
