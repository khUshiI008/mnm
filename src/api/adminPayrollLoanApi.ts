import client from './client';

export type PayrollLoanEmployee = { employeeId: number; code: string; employeeName: string; label: string };

export type PayrollLoanRow = {
  payrollOnLoanId: number;
  loanRef: string;
  employeeId: number;
  empCode: string;
  empName: string;
  employeeDisplay: string;
  deptName: string;
  loanAmountDisplay: string;
  totalEMIs: number;
  description: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  statusBadgeCss: string;
  deductedEMIs: number;
  progressPct: number;
  firstEMIMonthDisplay: string;
  paidDisplay: string;
  isSettled: boolean;
  outstandingDisplay: string;
  overdueAmt: number;
  overdueCount: number;
  overdueDisplay: string;
};

export type PayrollLoanGridResponse = {
  loans: PayrollLoanRow[];
  loanCount: number;
  loanBadge: number;
  totalDisbursedDisplay: string;
};

export type PayrollLoanScheduleRow = {
  scheduleId: number;
  payrollOnLoanId: number;
  loanRef: string;
  employeeDisplay: string;
  emiNumber: number;
  totalEMIs: number;
  salaryMonthDisplay: string;
  deductionAmount: number;
  deductionAmountDisplay: string;
  status: 'Pending' | 'Deducted' | 'Cancelled';
  statusDisplay: string;
  isLocked: boolean;
  statusBadgeCss: string;
  salaryMonthCss: 'done' | 'overdue' | 'today' | 'soon' | 'upcoming';
  salaryMonthLabel: string;
};

export type PayrollLoanScheduleGridResponse = {
  schedules: PayrollLoanScheduleRow[];
  stats: {
    pendingCount: number;
    pendingAmountDisplay: string;
    deductedThisMonthCount: number;
    deductedThisMonthDisplay: string;
  };
};

export type PayrollLoanReschedInfo = {
  empName: string;
  loanRef: string;
  principalDisplay?: string;
  paidDisplay?: string;
  outstanding: number;
  outstandingDisplay: string;
  pendingCount: number;
  currentEMIAmt?: number;
  currentEMIDisplay?: string;
};

export type PayrollLoanDetailResponse = {
  loan: {
    payrollOnLoanId: number;
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
  schedules: {
    scheduleId: number;
    emiNumber: number;
    totalEMIs: number;
    salaryMonthDisplay: string;
    salaryMonth: string;
    deductionAmountDisplay: string;
    status: string;
    isLocked: boolean;
    isOverdue: boolean;
    deductedDateDisplay: string | null;
    remarks: string;
  }[];
  lumpSums: { amountPaidDisplay: string; paymentDateDisplay: string; paymentMode: string; remarks: string; reschedulingOption: string }[];
  topUps: { amountGivenDisplay: string; disbursalDateDisplay: string; paymentMode: string; remarks: string; reschedulingOption: string }[];
};

export const getPayrollLoanEmployees = () => client.get<{ success: boolean; employees: PayrollLoanEmployee[] }>('/admin/payroll-loans/employees');

export const getPayrollLoanGrid = (search?: string) =>
  client.get<{ success: boolean } & PayrollLoanGridResponse>('/admin/payroll-loans', { params: search ? { search } : {} });

export const getPayrollLoanScheduleGrid = (params?: { loanId?: number; search?: string }) =>
  client.get<{ success: boolean } & PayrollLoanScheduleGridResponse>('/admin/payroll-loans/schedules', { params: params || {} });

export const getPayrollLoanDetail = (id: number) => client.get<{ success: boolean } & PayrollLoanDetailResponse>(`/admin/payroll-loans/${id}`);

export type CreatePayrollLoanPayload = {
  employeeId: number;
  loanAmount: number;
  // Exactly one of these two — see adminStaffLoanApi.ts's matching comment.
  totalEMIs?: number;
  monthlyAmount?: number;
  firstEMIMonth: string;
  disbursalDate?: string;
  description?: string;
};

export const createPayrollLoan = (payload: CreatePayrollLoanPayload) =>
  client.post<{ success: boolean; payrollOnLoanId: number; errors?: string[] }>('/admin/payroll-loans', payload);

export type PayrollLoanSchedulePreviewRow = { emiNumber: number; salaryMonthDisplay: string; amountDisplay: string };

export const previewPayrollLoanSchedule = (payload: CreatePayrollLoanPayload) =>
  client.post<{
    success: boolean;
    errors?: string[];
    totalEMIs?: number;
    baseEMIDisplay?: string;
    totalAmountDisplay?: string;
    schedule?: PayrollLoanSchedulePreviewRow[];
  }>('/admin/payroll-loans/preview', payload);

export const cancelPayrollLoan = (id: number) => client.post<{ success: boolean; message?: string }>(`/admin/payroll-loans/${id}/cancel`);

export const editPayrollLoanSchedule = (scheduleId: number, payload: { deductionAmount: number; salaryMonth?: string; remarks?: string }) =>
  client.put<{ success: boolean; message?: string }>(`/admin/payroll-loans/schedules/${scheduleId}`, payload);

// Moves a Pending, unlocked EMI to the month right after this advance's current last
// scheduled month — the EMI is not waived, the advance just finishes one month later.
export const skipPayrollLoanSchedule = (scheduleId: number) =>
  client.post<{ success: boolean; oldMonthDisplay?: string; newMonthDisplay?: string; message?: string }>(
    `/admin/payroll-loans/schedules/${scheduleId}/skip`
  );

export const getPayrollLumpSumInfo = (loanId: number) =>
  client.get<{ success: boolean } & PayrollLoanReschedInfo>(`/admin/payroll-loans/${loanId}/lump-sum-info`);

export const confirmPayrollLumpSum = (loanId: number, payload: { amount: number; paymentMode: string; remarks?: string; option: 'A' | 'B' }) =>
  client.post<{ success: boolean; settled?: boolean; message: string }>(`/admin/payroll-loans/${loanId}/lump-sum`, payload);

export const getPayrollTopUpInfo = (loanId: number) => client.get<{ success: boolean } & PayrollLoanReschedInfo>(`/admin/payroll-loans/${loanId}/top-up-info`);

export const confirmPayrollTopUp = (loanId: number, payload: { amount: number; paymentMode: string; remarks?: string; option: 'A' | 'B' }) =>
  client.post<{ success: boolean; message: string }>(`/admin/payroll-loans/${loanId}/top-up`, payload);

export const getPayrollRescheduleInfo = (loanId: number) =>
  client.get<{ success: boolean } & PayrollLoanReschedInfo>(`/admin/payroll-loans/${loanId}/reschedule-info`);

export const confirmPayrollReschedule = (loanId: number, payload: { newEMIAmount: number; remarks?: string }) =>
  client.post<{ success: boolean; message: string }>(`/admin/payroll-loans/${loanId}/reschedule`, payload);
