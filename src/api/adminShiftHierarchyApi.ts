import client from './client';

export type ShiftHierarchyMapping = {
  id: number;
  parentShiftId: number;
  parentShiftName: string;
  childShiftId: number;
  childShiftName: string;
  createdAtDisplay: string;
};

export type ShiftDropdownOption = { shiftId: number; shiftName: string };

export const getShiftHierarchyGrid = (params: { search?: string; sortCol?: string; sortDir?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; total: number; totalPages: number; page: number; mappings: ShiftHierarchyMapping[] }>('/admin/shift-hierarchy', { params });

export const getShiftHierarchyDropdown = () => client.get<{ success: boolean; shifts: ShiftDropdownOption[] }>('/admin/shift-hierarchy/shift-dropdown');

export const getChildIdsForParent = (parentId: number) =>
  client.get<{ success: boolean; childIds: number[] }>(`/admin/shift-hierarchy/parent/${parentId}/children`);

export const saveShiftHierarchyMapping = (payload: { parentShiftId: number; childShiftIds: number[]; isEditMode: boolean }) =>
  client.post<{ success: boolean; message: string; errors?: string[] }>('/admin/shift-hierarchy', payload);

export const deleteShiftHierarchyMapping = (id: number) => client.delete<{ success: boolean }>(`/admin/shift-hierarchy/${id}`);
