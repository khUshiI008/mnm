import client from './client';

export type AdvanceRow = {
  salaryAdvanceId: number;
  employeeId: number;
  empName: string;
  empCode: string;
  requestDateDisplay: string;
  salaryMonthDisplay: string;
  amount: number;
  amountDisplay: string;
  transferVia: string;
  bankReference: string;
  remarks: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  approvedBy: string;
  presentDays: number;
  leaveDays: number;
  eligibleDays: number;
  workingDays: number;
  maxEligible: number;
  maxEligibleDisplay: string;
  eligCss: 'elig-ok' | 'elig-over' | 'elig-unknown';
  eligPct: number;
  isEmployeeRequest: boolean;
};

export type AdvanceEmployee = { id: number; name: string; code: string; salary: number };

export type EligibilityInfo = {
  monthlySalary: number;
  monthLabel: string;
  workingDays: number;
  perDay: number;
  presentDays: number;
  leaveDays: number;
  eligibleDays: number;
  maxEligible: number;
  isPartialMonth: boolean;
  upToDisplay: string | null;
};

export const getAdvances = (params: { fromMonth?: string; toMonth?: string; status?: string; empId?: number; search?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; advances: AdvanceRow[] }>('/admin/salary-advance', { params });

export const searchAdvanceEmployees = (search?: string) =>
  client.get<{ success: boolean; employees: AdvanceEmployee[] }>('/admin/salary-advance/employees', { params: search ? { search } : {} });

export const getEligibility = (employeeId: number, month: string) =>
  client.get<{ success: boolean } & EligibilityInfo>(`/admin/salary-advance/eligibility/${employeeId}`, { params: { month } });

export type AdvancePayload = { employeeId: number; amount: number; salaryMonth: string; transferVia: string; bankReference?: string; remarks?: string };

export const createAdvance = (payload: AdvancePayload) => client.post<{ success: boolean; salaryAdvanceId: number; message: string }>('/admin/salary-advance', payload);

export const updateAdvance = (id: number, payload: AdvancePayload) =>
  client.put<{ success: boolean; salaryAdvanceId: number; message: string }>(`/admin/salary-advance/${id}`, payload);

export const approveAdvance = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/salary-advance/${id}/approve`);

export const markAdvancePaid = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/salary-advance/${id}/mark-paid`);

export const rejectAdvance = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/salary-advance/${id}/reject`);

export const deleteAdvance = (id: number) => client.delete<{ success: boolean; message: string }>(`/admin/salary-advance/${id}`);

export const bulkApproveAdvances = (ids: number[]) => client.post<{ success: boolean; approved: number; skipped: number; message: string }>('/admin/salary-advance/bulk-approve', { ids });

export const bulkApproveAllAdvances = () =>
  client.post<{ success: boolean; approved: number; skipped: number; message: string }>('/admin/salary-advance/bulk-approve-all');

export const bulkRejectAdvances = (ids: number[]) => client.post<{ success: boolean; rejected: number; skipped: number; message: string }>('/admin/salary-advance/bulk-reject', { ids });

export const bulkMarkPaidAdvances = (ids: number[]) =>
  client.post<{ success: boolean; paid: number; skipped: number; totalAmount: number; message: string }>('/admin/salary-advance/bulk-mark-paid', { ids });

export const bulkMarkPaidAllAdvances = () =>
  client.post<{ success: boolean; paid: number; skipped: number; totalAmount: number; message: string }>('/admin/salary-advance/bulk-mark-paid-all');

export const getApprovedSummary = () => client.get<{ success: boolean; count: number; totalAmount: number }>('/admin/salary-advance/approved-summary');

export const getPendingSummary = () => client.get<{ success: boolean; count: number; totalAmount: number }>('/admin/salary-advance/pending-summary');
