import client from './client';

export type LoanRequestItem = {
  loanRequestId: number;
  requestedAmount: number;
  requestedAmountDisplay: string;
  requestedEMIs: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedAmount: number | null;
  approvedAmountDisplay: string | null;
  approvedEMIs: number | null;
  adminRemarks: string | null;
  requestDateDisplay: string;
  decisionDateDisplay: string | null;
};

export const getMyLoanRequests = () => client.get<{ success: boolean; requests: LoanRequestItem[] }>('/loan-requests');

export type LoanRequestStatus = {
  success: boolean;
  canRequest: boolean;
  pending: LoanRequestItem | null;
  message: string | null;
};

export const getLoanRequestStatus = () => client.get<LoanRequestStatus>('/loan-requests/request-status');

export type SubmitLoanRequestPayload = {
  amount: number;
  emis: number;
  chequePhoto: string;
  signature: string;
  termsLanguage: 'en' | 'hi' | 'pa';
};

export const submitLoanRequest = (payload: SubmitLoanRequestPayload) =>
  client.post<{ success: boolean; message: string; loanRequestId?: number }>('/loan-requests/request', payload);
