import client from './client';

export type LeaveTypeRow = {
  leaveTypeId: number;
  leaveTypeName: string;
  shortCode: string;
  monthlyEntitlement: number;
  requiresApproval: boolean;
  isPaidLeave: boolean;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number;
  allowSameDayApplication: boolean;
  sameDayApplicationCutoffTime: string | null;
  sameDayLabel: string;
};

export type LeaveTypePayload = {
  leaveTypeName: string;
  shortCode: string;
  monthlyEntitlement: number;
  requiresApproval: boolean;
  isPaidLeave: boolean;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number;
  allowSameDayApplication: boolean;
  sameDayApplicationCutoffTime?: string;
};

export const getLeaveTypesAdmin = (search?: string) =>
  client.get<{ success: boolean; leaveTypes: LeaveTypeRow[] }>('/admin/leave-types', { params: search ? { search } : {} });

export const createLeaveType = (payload: LeaveTypePayload) =>
  client.post<{ success: boolean; leaveTypeId: number; errors?: string[] }>('/admin/leave-types', payload);

export const updateLeaveType = (id: number, payload: LeaveTypePayload) =>
  client.put<{ success: boolean; leaveTypeId: number; errors?: string[] }>(`/admin/leave-types/${id}`, payload);

export const deleteLeaveType = (id: number) => client.delete<{ success: boolean }>(`/admin/leave-types/${id}`);
