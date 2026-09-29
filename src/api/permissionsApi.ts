import client from './client';
import { PermissionGrant } from './authApi';

export const getMyPermissions = () => client.get<{ success: boolean; permissions: PermissionGrant[] }>('/profile/my-permissions');

export type PermissionActionOption = { key: string; label: string; fieldLevel?: boolean };
export type PermissionFieldOption = { key: string; label: string };
export type PermissionModule = {
  moduleKey: string;
  label: string;
  actions: PermissionActionOption[];
  editableFields: PermissionFieldOption[] | null;
};

export const getPermissionModules = () => client.get<{ success: boolean; modules: PermissionModule[] }>('/admin/permissions/modules');

export const getPermissionsForEmployee = (employeeId: number) =>
  client.get<{ success: boolean; employeeId: number; employeeName: string; code: string; grants: PermissionGrant[] }>(
    `/admin/permissions/${employeeId}`
  );

export const setPermissionsForEmployee = (employeeId: number, grants: PermissionGrant[]) =>
  client.put<{ success: boolean; message: string }>(`/admin/permissions/${employeeId}`, { grants });
