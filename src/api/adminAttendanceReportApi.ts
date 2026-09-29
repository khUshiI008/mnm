import client from './client';

export type EmployeeOption = { employeeId: number; code: string; name: string };

export type AttendanceReportRow = {
  attendanceId: number;
  employeeId: number;
  empCode: string;
  empName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workMinutes: number | null;
  netWorkMinutes: number | null;
  status: string;
  isEarlyGoing: boolean;
  source: string;
  hasSelfie: boolean;
};

export type ReportKpi = {
  total: number;
  present: number;
  late: number;
  earlyGoing: number;
  partial: number;
  absent: number;
  presentPct: string;
  latePct: string;
  earlyGoingPct: string;
  partialPct: string;
  absentPct: string;
};

export type EmployeeSummary = { daysAtWork: number; late: number; earlyGoing: number; leave: number; absent: number; lateChargeNote: string | null };

export type ReportFilters = { from: string; to: string; empId?: number | null; status?: string | null; minPunches?: number; page?: number; pageSize?: number };

export const getEmployees = () => client.get<{ success: boolean; employees: EmployeeOption[] }>('/admin/attendance-report/employees');

export const getReport = (params: ReportFilters) =>
  client.get<{ success: boolean; rows: AttendanceReportRow[]; total: number; page: number; pageSize: number; kpi: ReportKpi; employeeSummary: EmployeeSummary | null }>(
    '/admin/attendance-report',
    { params }
  );

export const getPunches = (empId: number, date: string) =>
  client.get<{ success: boolean; punches: { time: string; source: string; remarks: string | null }[]; isManualDay: boolean }>('/admin/attendance-report/punches', {
    params: { empId, date },
  });

export const saveCorrection = (empId: number, date: string, punchTimes: string[], remarks: string) =>
  client.post<{ success: boolean; message: string }>('/admin/attendance-report/correction', { empId, date, punchTimes, remarks });

export type PartialRow = { attendanceId: number; employeeId: number; empCode: string; empName: string; date: string; checkIn: string | null; punches: string[] };

export const getPartial = (params: { from: string; to: string; empId?: number | null; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; rows: PartialRow[]; total: number; page: number; pageSize: number }>('/admin/attendance-report/partial', { params });
