import client from './client';

export type SalaryHeadRow = {
  salaryHeadId: number;
  headName: string;
  headType: 'Earning' | 'Deduction';
  calcType: 'PercentOfBasic' | 'FixedAmount';
  value: number;
  displayOrder: number;
  valueDisplay: string;
};

export type SalaryHeadPayload = {
  headName: string;
  headType: string;
  calcType: string;
  value: number;
  displayOrder: number;
};

export type SalaryHeadOption = {
  salaryHeadId: number;
  headName: string;
  headType: string;
  calcType: string;
  value: number;
  label: string;
  defaultDisplay: string;
};

export type StructureEmployee = { employeeId: number; code: string; employeeName: string; label: string };

export type StructureComponent = {
  employeeSalaryHeadId: number;
  salaryHeadId: number;
  headName: string;
  headType: string;
  effCalcType: string;
  effValue: number;
  amount: number;
  amountDisplay: string;
  calcDesc: string;
};

export type StructureResponse = {
  employeeName: string;
  employeeCode: string;
  salaryMonthNote: string;
  basicSalaryDisplay: string;
  earnings: StructureComponent[];
  deductions: StructureComponent[];
  grossDisplay: string;
  deductionsDisplay: string;
  netDisplay: string;
};

export const getSalaryHeads = () => client.get<{ success: boolean; heads: SalaryHeadRow[] }>('/admin/salary-heads');

export const createSalaryHead = (payload: SalaryHeadPayload) =>
  client.post<{ success: boolean; salaryHeadId: number; errors?: string[] }>('/admin/salary-heads', payload);

export const updateSalaryHead = (id: number, payload: SalaryHeadPayload) =>
  client.put<{ success: boolean; salaryHeadId: number; errors?: string[] }>(`/admin/salary-heads/${id}`, payload);

export const deleteSalaryHead = (id: number) => client.delete<{ success: boolean }>(`/admin/salary-heads/${id}`);

export const getAssignableHeadOptions = () => client.get<{ success: boolean; heads: SalaryHeadOption[] }>('/admin/salary-heads/options');

export const getStructureEmployees = () => client.get<{ success: boolean; employees: StructureEmployee[] }>('/admin/salary-heads/structure/employees');

export const getStructure = (employeeId: number) => client.get<{ success: boolean } & StructureResponse>(`/admin/salary-heads/structure/${employeeId}`);

export type AssignmentPayload = { employeeSalaryHeadId?: number; employeeId: number; salaryHeadId: number; calcType?: string; value?: string };

export const saveAssignment = (payload: AssignmentPayload) =>
  client.post<{ success: boolean; employeeId: number; errors?: string[] }>('/admin/salary-heads/assignments', payload);

export const removeAssignment = (id: number) => client.delete<{ success: boolean; employeeId: number }>(`/admin/salary-heads/assignments/${id}`);
