import client from './client';

export type PayrollMonthOption = { value: string; label: string };

export type PayrollRow = {
  payrollId: number;
  employeeId: number;
  employeeDisplay: string;
  basicSalaryDisplay: string;
  totalEarningsDisplay: string;
  grossSalaryDisplay: string;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  lateDays: number;
  totalDeductionsDisplay: string;
  loanEMIDeductionDisplay: string;
  advanceDeductedDisplay: string;
  isRecovery: boolean;
  netPayableDisplay: string;
  status: 'Draft' | 'Generated' | 'Finalized';
  statusBadgeCss: string;
  departmentName: string;
  designationName: string;
  employmentTypeName: string;
  weekOffComp: string;
  /** Whether the employee can see this payslip in their app. Independent of status. */
  showToEmployee: boolean;
};

export type PayrollSummary = { empCount: number; monthLabel: string; totalGrossDisplay: string; totalDeductDisplay: string; totalNetDisplay: string };

export type PayrollSlipLine = { headName: string; calcDesc?: string; basis?: string; amountDisplay: string };

export type PayrollSlipResponse = {
  employee: { name: string; code: string; department: string; designation: string };
  payrollMonthDisplay: string;
  generatedOnDisplay: string;
  attendance: { present: number; absent: number; halfDay: number; late: number; early: number; woGiven: number; woWorked: number; plUsed: number };
  absentExplain: string;
  infoPills: Record<string, any>;
  earnings: PayrollSlipLine[];
  grossSalaryDisplay: string;
  deductions: PayrollSlipLine[];
  totalDeductionsDisplay: string;
  isRecovery: boolean;
  netPayableDisplay: string;
  recoveryAmountDisplay: string | null;
  standardDays: number;
  absentRateDisplay: string;
  calDays: number;
};

export const getPayrollMonths = () =>
  client.get<{ success: boolean; months: PayrollMonthOption[]; lastCompletedMonth: string }>('/admin/payroll/months');

export const generatePayroll = (month: string) =>
  client.post<{ success: boolean; month: string; ok: number; failed: number; errors: string[]; message: string }>('/admin/payroll/generate', { month });

export const getPayrollGrid = (month?: string) =>
  client.get<{ success: boolean; payrolls: PayrollRow[]; summary: PayrollSummary | null }>('/admin/payroll', { params: month ? { month } : {} });

export const finalizePayroll = (id: number) => client.post<{ success: boolean }>(`/admin/payroll/${id}/finalize`);

export const getPayrollSlip = (id: number) => client.get<{ success: boolean } & PayrollSlipResponse>(`/admin/payroll/${id}/slip`);

/** Flip one payslip's visibility to the employee. Never touches Status. */
export const togglePayrollVisibility = (id: number) =>
  client.post<{ success: boolean; showToEmployee: boolean; message: string }>(`/admin/payroll/${id}/visibility`);

/** Show/hide every payroll row for the given month at once. */
export const bulkSetPayrollVisibility = (month: string, visible: boolean) =>
  client.post<{ success: boolean; count: number; message: string }>('/admin/payroll/visibility/bulk', { month, visible });
