import client from './client';

export type StaffLoanEmployee = { employeeId: number; code: string; employeeName: string; label: string };

export type StaffLoanRow = {
  staffLoanId: number;
  loanRef: string;
  employeeId: number;
  empCode: string;
  empName: string;
  employeeDisplay: string;
  deptName: string;
  loanAmount: number;
  loanAmountDisplay: string;
  totalEMIs: number;
  dueDay: number;
  description: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  statusBadgeCss: string;
  firstEMIDateDisplay: string;
  receivedEMIs: number;
  progressPct: number;
  lumpSumCount: number;
  lumpSumDisplay: string | null;
  topUpCount: number;
  topUpDisplay: string | null;
  paidDisplay: string;
  outstandingDisplay: string;
  isSettled: boolean;
  overdueAmt: number;
  overdueCount: number;
  overdueDisplay: string;
};

export type StaffLoanGridResponse = {
  loans: StaffLoanRow[];
  loanCount: number;
  loanBadge: number;
  totalDisbursedDisplay: string;
  totalRemainingDisplay: string;
  filterOptions: { staffLoanId: number; label: string }[];
};

export type StaffLoanEmiRow = {
  emiScheduleId: number;
  staffLoanId: number;
  loanRef: string;
  employeeDisplay: string;
  emiNumber: number;
  totalEMIs: number;
  dueDateDisplay: string;
  emiAmount: number;
  emiAmountDisplay: string;
  receivedAmountDisplay: string;
  paymentMode: string;
  status: 'Pending' | 'Received';
  approvedBy: string;
  statusBadgeCss: string;
  dueDateCss: 'done' | 'overdue' | 'today' | 'soon' | 'upcoming';
  dueDateLabel: string;
};

export type StaffLoanEmiGridResponse = {
  emis: StaffLoanEmiRow[];
  stats: {
    pendingCount: number;
    pendingAmountDisplay: string;
    collectedCount: number;
    collectedAmountDisplay: string;
    overdueCount: number;
    overdueAmountDisplay: string;
  };
};

export type LoanReschedInfo = {
  empName: string;
  loanRef: string;
  principalDisplay?: string;
  paidDisplay?: string;
  outstanding: number;
  outstandingDisplay: string;
  pendingCount: number;
  currentEMIAmt?: number;
  currentEMIDisplay?: string;
  dueDay?: number;
};

export type LoanDetailResponse = {
  loan: {
    staffLoanId: number;
    loanRef: string;
    empName: string;
    empCode: string;
    status: string;
    description: string;
    disbursalDateDisplay: string;
    principalDisplay: string;
    paidDisplay: string;
    remainingDisplay: string;
    overdueCount: number;
  };
  emis: {
    emiScheduleId: number;
    emiNumber: number;
    totalEMIs: number;
    dueDateDisplay: string;
    emiAmountDisplay: string;
    receivedAmountDisplay: string | null;
    receivedDateDisplay: string | null;
    paymentMode: string;
    status: string;
    isOverdue: boolean;
  }[];
  lumpSums: { amountPaidDisplay: string; paymentDateDisplay: string; paymentMode: string; remarks: string; reschedulingOption: string }[];
  topUps: { amountGivenDisplay: string; disbursalDateDisplay: string; paymentMode: string; remarks: string; reschedulingOption: string }[];
};

export const getStaffLoanEmployees = () => client.get<{ success: boolean; employees: StaffLoanEmployee[] }>('/admin/staff-loans/employees');

export const getStaffLoanGrid = (search?: string) => client.get<{ success: boolean } & StaffLoanGridResponse>('/admin/staff-loans', { params: search ? { search } : {} });

export const getStaffLoanEmiGrid = (params?: { loanId?: number; search?: string }) =>
  client.get<{ success: boolean } & StaffLoanEmiGridResponse>('/admin/staff-loans/emis', { params: params || {} });

export const getLoanDetail = (id: number) => client.get<{ success: boolean } & LoanDetailResponse>(`/admin/staff-loans/${id}`);

export type CreateLoanPayload = {
  employeeId: number;
  loanAmount: number;
  // Exactly one of these two — totalEMIs (a raw installment count) or
  // monthlyAmount (a target monthly instalment; count is derived server-side,
  // see loanAmountScheduleHelper.js's remainder rule).
  totalEMIs?: number;
  monthlyAmount?: number;
  dueDay: number;
  firstEMIMonth: string;
  disbursalDate?: string;
  description?: string;
};

export const createStaffLoan = (payload: CreateLoanPayload) =>
  client.post<{ success: boolean; staffLoanId: number; errors?: string[] }>('/admin/staff-loans', payload);

export type LoanSchedulePreviewRow = { emiNumber: number; dueDateDisplay: string; amountDisplay: string };

export const previewStaffLoanSchedule = (payload: CreateLoanPayload) =>
  client.post<{
    success: boolean;
    errors?: string[];
    totalEMIs?: number;
    baseEMIDisplay?: string;
    totalAmountDisplay?: string;
    schedule?: LoanSchedulePreviewRow[];
  }>('/admin/staff-loans/preview', payload);

export const cancelStaffLoan = (id: number) => client.post<{ success: boolean; message?: string }>(`/admin/staff-loans/${id}/cancel`);

export const receiveStaffLoanEmi = (emiId: number, payload: { amount: number; paymentMode: string; remarks?: string }) =>
  client.post<{ success: boolean; message?: string }>(`/admin/staff-loans/emis/${emiId}/receive`, payload);

export const getLumpSumInfo = (loanId: number) => client.get<{ success: boolean } & LoanReschedInfo>(`/admin/staff-loans/${loanId}/lump-sum-info`);

export const confirmLumpSum = (loanId: number, payload: { amount: number; paymentMode: string; remarks?: string; option: 'A' | 'B' }) =>
  client.post<{ success: boolean; settled?: boolean; message: string }>(`/admin/staff-loans/${loanId}/lump-sum`, payload);

export const getTopUpInfo = (loanId: number) => client.get<{ success: boolean } & LoanReschedInfo>(`/admin/staff-loans/${loanId}/top-up-info`);

export const confirmTopUp = (loanId: number, payload: { amount: number; paymentMode: string; remarks?: string; option: 'A' | 'B' }) =>
  client.post<{ success: boolean; message: string }>(`/admin/staff-loans/${loanId}/top-up`, payload);

export const getRescheduleInfo = (loanId: number) => client.get<{ success: boolean } & LoanReschedInfo>(`/admin/staff-loans/${loanId}/reschedule-info`);

export const confirmReschedule = (loanId: number, payload: { newEMIAmount: number; remarks?: string }) =>
  client.post<{ success: boolean; message: string }>(`/admin/staff-loans/${loanId}/reschedule`, payload);
