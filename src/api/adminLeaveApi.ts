import client from './client';

export type LeaveTypeOption = { leaveTypeId: number; name: string; shortCode: string };

export type ApprovalCard = {
  leaveApplicationId: number;
  employeeId: number;
  empName: string;
  empCode: string;
  deptName: string;
  photoPath: string;
  leaveTypeName: string;
  shortCode: string;
  isPaid: 'Paid' | 'LWP';
  fromDateDisplay: string;
  toDateDisplay: string;
  appliedOnDisplay: string;
  daysLabel: string;
  totalDays: number;
  reason: string;
  status: string;
  routingType: string;
  approverName: string;
  resolvedBy: string;
  resolvedOnDisplay: string;
  alreadyTakenThisMonth: number;
  absentThisMonth: number;
  halfDayThisMonth: number;
};

export const getLeaveTypes = () => client.get<{ success: boolean; types: LeaveTypeOption[] }>('/admin/leave/types');

export const getApprovalQueue = (params: { status?: string; typeId?: number; search?: string; sortCol?: string; sortDir?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; cards: ApprovalCard[] }>('/admin/leave/approval', { params });

export const checkApprovalConflict = (id: number) =>
  client.get<{
    success: boolean;
    hasDeptConflict: boolean;
    deptName?: string;
    fromDateDisplay?: string;
    toDateDisplay?: string;
    deptConflicts?: { employeeName: string; fromDateDisplay: string; toDateDisplay: string }[];
    ownOtherLeaves?: { leaveTypeName: string; fromDateDisplay: string; toDateDisplay: string }[];
    clQuotaExceeded?: boolean;
    clConsumed?: number;
    clQuota?: number;
    clRemaining?: number;
    clRequested?: number;
  }>(`/admin/leave/approval/${id}/conflict-check`);

export const approveLeaveApplication = (id: number, forceClQuotaOverride?: boolean) =>
  client.post<{ success: boolean; message: string; warning?: boolean; clQuotaBlocked?: boolean; clConsumed?: number; clQuota?: number; clRemaining?: number }>(
    `/admin/leave/approval/${id}/approve`,
    forceClQuotaOverride ? { forceClQuotaOverride: true } : undefined
  );

export const rejectLeaveApplication = (id: number, remarks: string) =>
  client.post<{ success: boolean; message: string }>(`/admin/leave/approval/${id}/reject`, { remarks });

// ---- Leave Admin (KPI + table + Cancel + balance matrix) ----

export type LeaveAdminKpis = { pending: number; approvedThisMonth: number; approvedDaysThisMonth: number; rejectedThisMonth: number; totalThisMonth: number };

export type LeaveAdminRow = {
  leaveApplicationId: number;
  empName: string;
  empCode: string;
  leaveTypeName: string;
  shortCode: string;
  fromDateDisplay: string;
  toDateDisplay: string;
  totalDays: number;
  status: string;
  routingType: string;
  actionedBy: { awaiting: true } | { awaiting: false; name: string; dateDisplay: string };
};

export type BalanceMatrixCell = { shortCode: string; remaining: number; entitled: number; color: 'gray' | 'red' | 'blue' };
export type BalanceMatrixRow = { employeeId: number; employeeName: string; code: string; cells: BalanceMatrixCell[] };

export const getLeaveAdminKpis = () => client.get<{ success: boolean } & LeaveAdminKpis>('/admin/leave/admin/kpis');

export const getLeaveAdminGrid = (params: { status?: string; typeId?: number; search?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; rows: LeaveAdminRow[] }>('/admin/leave/admin', { params });

export const getBalanceMatrix = () =>
  client.get<{ success: boolean; monthLabel: string; leaveTypes: { shortCode: string; name: string }[]; rows: BalanceMatrixRow[] }>('/admin/leave/admin/balance-matrix');

export const adminApproveLeave = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/leave/admin/${id}/approve`);

export const adminRejectLeave = (id: number, remarks: string) => client.post<{ success: boolean; message: string }>(`/admin/leave/admin/${id}/reject`, { remarks });

export const adminCancelLeave = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/leave/admin/${id}/cancel`);

export type LeaveDecisionStatus = 'Approved' | 'Rejected' | 'Cancelled' | 'Pending';

export const changeLeaveDecision = (id: number, newStatus: LeaveDecisionStatus, remarks: string) =>
  client.post<{ success: boolean; message: string }>(`/admin/leave/admin/${id}/change-decision`, { newStatus, remarks });

// ---- Leave Application (apply on behalf) ----

export type EmployeePickerItem = { id: number; name: string; code: string };
export type BalanceItem = { shortCode: string; entitled: number; used: number; remaining: number };

export type ApplicationRow = {
  leaveApplicationId: number;
  employeeId: number;
  empName: string;
  empCode: string;
  leaveTypeName: string;
  shortCode: string;
  fromDateDisplay: string;
  toDateDisplay: string;
  totalDays: number;
  reason: string;
  status: string;
  approverName: string;
  routingType: string;
};

export const searchEmployeesForLeave = (search?: string) =>
  client.get<{ success: boolean; employees: EmployeePickerItem[] }>('/admin/leave/application/employees', { params: search ? { search } : {} });

export const getEmployeeLeaveBalances = (employeeId: number) =>
  client.get<{ success: boolean; balances: BalanceItem[] }>(`/admin/leave/application/balances/${employeeId}`);

export const getApplicationHistory = (params: { empId?: number; status?: string; typeId?: number; search?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; rows: ApplicationRow[] }>('/admin/leave/application', { params });

export type ApplyPayload = { employeeId: number; leaveTypeId: number; fromDate: string; toDate: string; reason: string };

export const createLeaveApplication = (payload: ApplyPayload) =>
  client.post<{ success: boolean; leaveApplicationId: number; message: string }>('/admin/leave/application', payload);

export const updateLeaveApplication = (id: number, payload: ApplyPayload) =>
  client.put<{ success: boolean; leaveApplicationId: number; message: string }>(`/admin/leave/application/${id}`, payload);

export const cancelLeaveApplication = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/leave/application/${id}/cancel`);

/** Quick "Mark Leave" from the dashboard's Not Yet Come list — admin picks the date range, only active leave type, auto-approved regardless of remaining balance. */
export const markLeaveQuick = (employeeId: number, fromDate: string, toDate: string) =>
  client.post<{ success: boolean; leaveApplicationId?: number; message: string }>('/admin/leave/application/mark-quick', { employeeId, fromDate, toDate });
