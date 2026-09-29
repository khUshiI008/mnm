import client from './client';

export type PayslipListItem = {
  payrollId: number;
  payrollMonth: string;
  grossSalary: number;
  totalDeductions: number;
  netPayable: number;
  isRecovery: boolean;
  presentDays: number;
};

export type PayslipDetail = {
  success: boolean;
  payrollId: number;
  payrollMonth: string;
  generatedAt: string | null;
  employee: { name: string; code: string; department: string | null; designation: string | null };
  attendance: {
    present: number;
    absent: number;
    partial: number;
    late: number;
    early: number;
    weekOffGiven: number;
    weekOffWorked: number;
    plUsed: number;
    workingDays: number;
    absentExplain: string;
  };
  earnings: {
    basicSalary: number;
    heads: { headName: string; calcType: string; value: number; amount: number }[];
    overtimeAmount: number;
    overtimeMinutes: number;
    otEarlyMinutes: number;
    otEarlyAmount: number;
    otLateMinutes: number;
    otLateAmount: number;
    weekOffWorkAmount: number;
    weekOffWorkDays: number;
    attendanceBonusAmount: number;
    attendanceBonusDays: number;
    grossSalary: number;
  };
  deductions: {
    heads: { headName: string; calcType: string; value: number; amount: number }[];
    absentDeductAmount: number;
    halfDayDeductAmount: number;
    breakDeductAmount: number;
    breakExcessMinutes: number;
    lateChargeDeductAmount: number;
    lateDays: number;
    lateMinsDeductAmount: number;
    lateMinsTotal: number;
    earlyGoingDeductAmount: number;
    earlyGoingMinsTotal: number;
    advanceDeducted: number;
    loanEMIDeduction: number;
    totalDeductions: number;
  };
  netPayable: number;
  isRecovery: boolean;
};

export const getPayslips = (year: number) =>
  client.get<{ success: boolean; payslips: PayslipListItem[] }>('/payslips', { params: { year } });

export const getPayslipDetail = (payrollId: number) => client.get<PayslipDetail>(`/payslips/${payrollId}`);
