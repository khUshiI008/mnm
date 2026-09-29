import client from './client';

export type LoanRequestRow = {
  loanRequestId: number;
  employeeId: number;
  empCode: string;
  empName: string;
  deptName: string;
  requestedAmount: number;
  requestedAmountDisplay: string;
  requestedEMIs: number;
  chequePhotoUrl: string | null;
  signaturePath: string | null;
  termsLanguage: 'en' | 'hi' | 'pa';
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedAmount: number | null;
  approvedEMIs: number | null;
  adminRemarks: string | null;
  staffLoanId: number | null;
  requestDateDisplay: string;
  decisionDateDisplay: string | null;
  decidedBy: string | null;
};

export const getLoanRequests = (status?: string) =>
  client.get<{ success: boolean; requests: LoanRequestRow[]; pendingCount: number }>('/admin/loan-requests', { params: status ? { status } : {} });

export type ApproveLoanRequestPayload = {
  amount?: number;
  emis?: number;
  dueDay: number;
  firstEMIMonth: string;
  disbursalDate?: string;
  description?: string;
  remarks?: string;
};

export const approveLoanRequest = (id: number, payload: ApproveLoanRequestPayload) =>
  client.post<{ success: boolean; staffLoanId?: number; message: string }>(`/admin/loan-requests/${id}/approve`, payload);

export const rejectLoanRequest = (id: number, remarks: string) =>
  client.post<{ success: boolean; message: string }>(`/admin/loan-requests/${id}/reject`, { remarks });
