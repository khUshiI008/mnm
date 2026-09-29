import client from './client';

export type LeaveTypeOption = {
  leaveTypeId: number;
  name: string;
  shortCode: string;
  isPaidLeave: boolean;
  allowSameDayApplication: boolean;
  sameDayApplicationCutoffTime: string | null;
};

export type LeaveBalanceItem = {
  leaveTypeId: number;
  name: string;
  shortCode: string;
  isPaidLeave: boolean;
  entitled: number;
  used: number;
  remaining: number;
};

export type LeaveApplicationItem = {
  leaveApplicationId: number;
  leaveTypeName: string;
  shortCode: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  approverName: string;
  appliedOn: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  remarks: string | null;
};

export const getLeaveTypes = () => client.get<{ success: boolean; types: LeaveTypeOption[] }>('/leave/types');

export const getLeaveBalances = () => client.get<{ success: boolean; month: string; balances: LeaveBalanceItem[] }>('/leave/balances');

export const getLeaveApplications = (status?: string) =>
  client.get<{ success: boolean; applications: LeaveApplicationItem[] }>('/leave/applications', { params: status ? { status } : {} });

export const applyLeave = (payload: { leaveTypeId: number; fromDate: string; toDate: string; reason: string }) =>
  client.post('/leave/apply', payload);

// ---- Manager leave approvals — mirrors Dashboard.aspx.cs's BindPendingApprovals/btnApproveLv_Click/btnRejectLv_Click ----

export type PendingApproval = {
  leaveApplicationId: number;
  empName: string;
  shortCode: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  appliedOn: string;
};

export const getPendingApprovals = () => client.get<{ success: boolean; pending: PendingApproval[] }>('/leave/pending-approvals');

export const approveLeave = (id: number) => client.post<{ success: boolean; message: string }>(`/leave/${id}/approve`);

export const rejectLeave = (id: number, remarks?: string) =>
  client.post<{ success: boolean; message: string }>(`/leave/${id}/reject`, { remarks });
