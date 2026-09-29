import client from './client';

export type LeavePolicyRow = {
  leavePolicyId: number;
  policyName: string;
  weekOffDay: 'None' | 'Sunday' | 'Saturday' | 'SaturdaySunday';
  weekOffLabel: string;
  blockWeekOffLeave: boolean;
  allowedLeaveDaysPerMonth: number;
  description: string | null;
};

export type LeavePolicyPayload = {
  policyName: string;
  weekOffDay: 'None' | 'Sunday' | 'Saturday' | 'SaturdaySunday';
  blockWeekOffLeave: boolean;
  allowedLeaveDaysPerMonth: number;
  description?: string;
};

export const getLeavePolicies = (search?: string) =>
  client.get<{ success: boolean; policies: LeavePolicyRow[] }>('/admin/leave-policies', { params: search ? { search } : {} });

export const createLeavePolicy = (payload: LeavePolicyPayload) =>
  client.post<{ success: boolean; leavePolicyId: number; errors?: string[] }>('/admin/leave-policies', payload);

export const updateLeavePolicy = (id: number, payload: LeavePolicyPayload) =>
  client.put<{ success: boolean; leavePolicyId: number; errors?: string[] }>(`/admin/leave-policies/${id}`, payload);

export const deleteLeavePolicy = (id: number) => client.delete<{ success: boolean }>(`/admin/leave-policies/${id}`);
