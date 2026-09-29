import client from './client';

export type SalaryRevisionEmployee = { employeeId: number; code: string; employeeName: string; label: string };

export type SalaryRevisionRow = {
  salaryRevisionId: number;
  employeeId: number;
  code: string;
  employeeName: string;
  basicSalary: number;
  basicSalaryDisplay: string;
  effectiveFromDisplay: string;
  effectiveFrom: string;
  effectiveToDisplay: string;
  isCurrent: boolean;
  revisionType: string;
  reasonNote: string;
};

export type SalaryRevisionPayload = {
  employeeId: number;
  basicSalary: number;
  effectiveFrom: string;
  revisionType: string;
  reasonNote?: string;
};

export const getSalaryRevisionEmployees = () =>
  client.get<{ success: boolean; employees: SalaryRevisionEmployee[] }>('/admin/salary-revisions/employees');

export const getSalaryRevisions = () => client.get<{ success: boolean; revisions: SalaryRevisionRow[] }>('/admin/salary-revisions');

export const createSalaryRevision = (payload: SalaryRevisionPayload) =>
  client.post<{ success: boolean; salaryRevisionId: number; errors?: string[] }>('/admin/salary-revisions', payload);

export const updateSalaryRevision = (id: number, payload: SalaryRevisionPayload) =>
  client.put<{ success: boolean; salaryRevisionId: number; errors?: string[] }>(`/admin/salary-revisions/${id}`, payload);

export const deleteSalaryRevision = (id: number) => client.delete<{ success: boolean }>(`/admin/salary-revisions/${id}`);
