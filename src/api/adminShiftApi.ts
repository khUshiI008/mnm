import client from './client';

export type ShiftRow = {
  shiftId: number;
  shiftName: string;
  status: string;
  startTime: string;
  endTime: string;
  startTimeDisplay: string;
  endTimeDisplay: string;
  durationDisplay: string;
  breakDurationMinutes: number;
  requiredWorkingDisplay: string;
  graceTimeMinutes: number;
  graceOccurrencesPerMonth: number;
  lateChargeAmount: number;
  earlyGoingAllowed: boolean;
  otApplicable: boolean;
  otBufferMinutes: number;
  activeEmployeeCount: number;
};

export type ShiftDropdownOption = { shiftId: number; shiftName: string; label: string };

export type ShiftPayload = {
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  graceTimeMinutes: number;
  graceOccurrencesPerMonth: number;
  lateChargeAmount?: string;
  earlyGoingAllowed: boolean;
  otApplicable: boolean;
  otBufferMinutes: number;
};

export const getShifts = (search?: string) => client.get<{ success: boolean; shifts: ShiftRow[] }>('/admin/shifts', { params: search ? { search } : {} });

export const getShiftDropdown = () => client.get<{ success: boolean; shifts: ShiftDropdownOption[] }>('/admin/shifts/dropdown');

export const createShift = (payload: ShiftPayload) => client.post<{ success: boolean; shiftId: number; errors?: string[] }>('/admin/shifts', payload);

export const updateShift = (id: number, payload: ShiftPayload) => client.put<{ success: boolean; shiftId: number; errors?: string[] }>(`/admin/shifts/${id}`, payload);

export const deleteShift = (id: number) => client.delete<{ success: boolean }>(`/admin/shifts/${id}`);

export type ShiftAssignmentHistoryItem = {
  assignmentId: number;
  shiftId: number;
  shiftName: string;
  shiftLabel: string;
  effectiveFromDisplay: string;
  effectiveToDisplay: string | null;
  isCurrent: boolean;
  assignedBy: string;
  assignedAtDisplay: string;
};

export const getShiftAssignmentHistory = (employeeId: number) =>
  client.get<{ success: boolean; history: ShiftAssignmentHistoryItem[] }>(`/admin/employees/${employeeId}/shift-assignments`);

export const assignEmployeeShift = (employeeId: number, payload: { shiftId: number; effectiveFrom: string }) =>
  client.post<{ success: boolean; message: string }>(`/admin/employees/${employeeId}/shift-assignments`, payload);
