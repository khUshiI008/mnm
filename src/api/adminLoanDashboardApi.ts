import client from './client';

export type LoanKpiBucket = { count: number; amount: number };
export type LoanKpis = { dueThisMonth: LoanKpiBucket; overdue: LoanKpiBucket };

export type LoanEmiRow = {
  // 'staff' = "Staff Brand Loans" in the sidebar (cash-collected, StaffLoan);
  // 'payroll' = "Staff Loans" in the sidebar (payroll-deducted, PayrollOnLoan).
  loanType: 'staff' | 'payroll';
  emiScheduleId: number;
  emiNumber: number;
  totalEMIs: number;
  staffLoanId: number | null;
  loanRef: string;
  empName: string;
  empCode: string;
  dueDateDisplay: string;
  emiAmountDisplay: string;
  badgeText: string;
};

export const getLoanDashboardKpis = () => client.get<{ success: boolean } & LoanKpis>('/admin/loan-dashboard/kpis');

export const getLoanDashboardGrid = (params: { bucket: string; search?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; gridTitle: string; rows: LoanEmiRow[] }>('/admin/loan-dashboard', { params });

export const receiveEmiPayment = (id: number, payload: { amount: number; paymentMode: string; remarks?: string }) =>
  client.post<{ success: boolean; partial: boolean; loanCompleted: boolean; remainingAmount?: number; message: string }>(
    `/admin/loan-dashboard/${id}/receive`,
    payload
  );

export const skipEmi = (id: number, payload: { remarks?: string }) =>
  client.post<{ success: boolean; message: string }>(`/admin/loan-dashboard/${id}/skip`, payload);

export const notifyOverdueEmi = (id: number) =>
  client.post<{ success: boolean; message: string }>(`/admin/loan-dashboard/${id}/notify`);

export const notifyAllOverdueEmployees = () =>
  client.post<{ success: boolean; message: string }>('/admin/loan-dashboard/notify-all-overdue');
