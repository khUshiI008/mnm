import client from './client';

export type SalaryAdvancePolicyRow = {
  salaryAdvancePolicyId: number;
  policyName: string;
  effectiveFromDisplay: string;
  maxAdvancePercent: number;
  clThresholdDays: number;
  daysInMonth: number;
  processingDay: number;
  isCurrent: boolean;
};

export type SalaryAdvancePolicyPayload = {
  policyName: string;
  effectiveFrom: string;
  maxAdvancePercent: number;
  clThresholdDays: number;
  daysInMonth: number;
  processingDay: number;
  isCurrent: boolean;
};

export const getSalaryAdvancePolicies = (search?: string) =>
  client.get<{ success: boolean; policies: SalaryAdvancePolicyRow[] }>('/admin/salary-advance-policies', { params: search ? { search } : {} });

export const createSalaryAdvancePolicy = (payload: SalaryAdvancePolicyPayload) =>
  client.post<{ success: boolean; salaryAdvancePolicyId: number; errors?: string[] }>('/admin/salary-advance-policies', payload);

export const updateSalaryAdvancePolicy = (id: number, payload: SalaryAdvancePolicyPayload) =>
  client.put<{ success: boolean; salaryAdvancePolicyId: number; errors?: string[] }>(`/admin/salary-advance-policies/${id}`, payload);

export const deleteSalaryAdvancePolicy = (id: number) => client.delete<{ success: boolean }>(`/admin/salary-advance-policies/${id}`);
