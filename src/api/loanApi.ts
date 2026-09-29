import client from './client';

export type EmiRow = {
  emiScheduleId: number;
  emiNumber: number;
  totalEmis: number;
  dueDate: string;
  emiAmount: number;
  receivedAmount: number | null;
  paymentMode: string | null;
  status: 'Pending' | 'Received';
  remarks: string | null;
  isNext: boolean;
};

export type LumpSumRow = { paymentDate: string; amountPaid: number; paymentMode: string | null; reschedulingOption: string; remarks: string | null };
export type TopUpRow = { disbursalDate: string; amountGiven: number; paymentMode: string | null; reschedulingOption: string; remarks: string | null };

export type LoanItem = {
  // 'staff' = "Staff Brand Loans" in the admin sidebar (cash-collected);
  // 'payroll' = "Staff Loans" in the admin sidebar (payroll-deducted advance).
  loanType: 'staff' | 'payroll';
  staffLoanId: number;
  loanRef: string;
  loanAmount: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  disbursalDate: string;
  description: string | null;
  totalEmis: number;
  paidEmis: number;
  pendingEmis: number;
  paidAmount: number;
  remainingAmount: number;
  progressPct: number;
  emiSchedule: EmiRow[];
  lumpSumPayments: LumpSumRow[];
  topUps: TopUpRow[];
};

export const getLoans = () => client.get<{ success: boolean; loans: LoanItem[] }>('/loans');

export type OverdueLoanStatus = { success: boolean; hasOverdue: boolean; count: number; totalAmount: number };

/** Lightweight per-employee check for the app-wide overdue-EMI alert (EmployeeStack.tsx) — Brand/StaffLoan only. */
export const getLoanOverdueStatus = () => client.get<OverdueLoanStatus>('/loans/overdue-status');

export type DueTodayLoanStatus = { success: boolean; hasDueToday: boolean; count: number; totalAmount: number };

/**
 * Lightweight per-employee check for the app-wide "due today" alert
 * (LoanDueTodayAlert.tsx) — Brand/StaffLoan only. Deliberately not throttled
 * client-side, unlike getLoanOverdueStatus — this re-fires every app open on
 * the due date itself.
 */
export const getLoanDueTodayStatus = () => client.get<DueTodayLoanStatus>('/loans/due-today-status');
