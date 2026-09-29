import client from './client';

export type RecoveryEmployee = { employeeId: number; code: string; employeeName: string; label: string };

export type RecoveryScheduleRow = {
  recoveryScheduleId: number;
  employeeId: number;
  employeeDisplay: string;
  amountDisplay: string;
  dueDay: number;
  description: string;
  startDateDisplay: string;
  startDate: string;
  endDateDisplay: string;
  endDate: string | null;
  isActive: boolean;
  statusLabel: string;
};

export type MonthlyRecoveryRow = {
  recoveryId: number;
  employeeId: number;
  employeeDisplay: string;
  entryDateDisplay: string;
  recoveryMonthDisplay: string;
  targetAmount: number;
  targetAmountDisplay: string;
  receivedAmountDisplay: string;
  paymentMode: string;
  description: string;
  status: 'Pending' | 'Received';
  approvedBy: string;
  statusBadgeCss: string;
  dueDateCss: 'due-today' | 'due-soon' | '';
  dueDateLabel: string;
};

export type RecoverySummary = { pendingCount: number; pendingAmountDisplay: string; receivedCount: number; receivedAmountDisplay: string; totalTargetDisplay: string };

export const getRecoveryEmployees = () => client.get<{ success: boolean; employees: RecoveryEmployee[] }>('/admin/monthly-recoveries/employees');

export const getRecoverySchedules = () =>
  client.get<{ success: boolean; schedules: RecoveryScheduleRow[]; activeCount: number }>('/admin/monthly-recoveries/schedules');

export const getMonthlyRecoveries = () =>
  client.get<{ success: boolean; recoveries: MonthlyRecoveryRow[]; summary: RecoverySummary }>('/admin/monthly-recoveries');

export type SchedulePayload = { employeeId: number; amount: number; dueDay: number; startDate: string; endDate?: string; description?: string };

export const createSchedule = (payload: SchedulePayload) =>
  client.post<{ success: boolean; recoveryScheduleId: number; errors?: string[] }>('/admin/monthly-recoveries/schedules', payload);

export const updateSchedule = (id: number, payload: SchedulePayload) =>
  client.put<{ success: boolean; recoveryScheduleId: number; errors?: string[] }>(`/admin/monthly-recoveries/schedules/${id}`, payload);

export const activateSchedule = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/monthly-recoveries/schedules/${id}/activate`);

export const deactivateSchedule = (id: number) => client.post<{ success: boolean; message: string }>(`/admin/monthly-recoveries/schedules/${id}/deactivate`);

export const receiveRecovery = (id: number, payload: { receivedAmount: number; paymentMode: string; remarks?: string }) =>
  client.post<{ success: boolean }>(`/admin/monthly-recoveries/${id}/receive`, payload);

export const deleteRecovery = (id: number) => client.delete<{ success: boolean }>(`/admin/monthly-recoveries/${id}`);
