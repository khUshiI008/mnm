import client from './client';

export type AttendancePolicyRow = {
  attendancePolicyId: number;
  policyName: string;
  effectiveFromDisplay: string;
  effectiveFrom: string;
  fullDayMinimumMinutes: number;
  halfDayMinimumMinutes: number;
  halfDayDeductionPercent: number;
  isCurrent: boolean;
  absentT1Max: number;
  absentT2Max: number;
  absentT3Max: number;
  absentT3Grace: number;
  absentT3PLConsumed: number;
  absentT4Count: number;
  absentT4DeductDays: number;
  absentT4PLConsumed: number;
};

export type AttendancePolicyPayload = {
  policyName: string;
  effectiveFrom: string;
  fullDayMinimumMinutes: number;
  halfDayMinimumMinutes: number;
  halfDayDeductionPercent: number;
  isCurrent: boolean;
  absentT1Max: number;
  absentT2Max: number;
  absentT3Max: number;
  absentT3Grace: number;
  absentT3PLConsumed: number;
  absentT4Count: number;
  absentT4DeductDays: number;
  absentT4PLConsumed: number;
};

export const getAttendancePolicies = (search?: string) =>
  client.get<{ success: boolean; policies: AttendancePolicyRow[] }>('/admin/attendance-policies', { params: search ? { search } : {} });

export const createAttendancePolicy = (payload: AttendancePolicyPayload) =>
  client.post<{ success: boolean; attendancePolicyId: number; errors?: string[] }>('/admin/attendance-policies', payload);

export const updateAttendancePolicy = (id: number, payload: AttendancePolicyPayload) =>
  client.put<{ success: boolean; attendancePolicyId: number; errors?: string[] }>(`/admin/attendance-policies/${id}`, payload);

export const deleteAttendancePolicy = (id: number) => client.delete<{ success: boolean }>(`/admin/attendance-policies/${id}`);
