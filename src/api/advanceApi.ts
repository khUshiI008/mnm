import client from './client';

export type AdvanceItem = {
  salaryAdvanceId: number;
  requestDate: string;
  salaryMonth: string;
  amount: number;
  transferVia: string | null;
  bankReference: string | null;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  approvedBy: string | null;
  paidDate: string | null;
  remarks: string | null;
};

export const getAdvances = (year: number) =>
  client.get<{
    success: boolean;
    counts: { total: number; pending: number; approved: number; paid: number; rejected: number };
    advances: AdvanceItem[];
  }>('/advances', { params: { year } });

export type AdvanceRequestStatus = {
  success: boolean;
  visible: boolean;
  windowStatus: 'open' | 'soon' | 'closed';
  inWindow: boolean;
  eligible: boolean;
  capAmount: number;
  salaryMonthDisplay?: string;
  message: string | null;
  existing: {
    status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
    amount: number;
    salaryMonthDisplay: string;
    requestDateDisplay: string;
    approvedBy: string | null;
  } | null;
};

export const getAdvanceRequestStatus = () => client.get<AdvanceRequestStatus>('/advances/request-status');

export const requestAdvance = () =>
  client.post<{ success: boolean; message: string; amount?: number; salaryAdvanceId?: number }>('/advances/request');
