import client from './client';
import { EmployeeOption } from './adminAttendanceReportApi';

export type BiometricReportRow = {
  empId: number;
  empCode: string;
  empName: string;
  bioCode: string;
  date: string;
  swipeCount: number;
  firstIn: string | null;
  lastOut: string | null;
  netWorkDisplay: string;
  status: string;
  isLate: boolean;
  isEarlyGoing: boolean;
};

export type BioReportKpi = {
  total: number;
  present: number;
  late: number;
  partial: number;
  absent: number;
  earlyGoing: number;
  presentPct: string;
  latePct: string;
  partialPct: string;
  absentPct: string;
  earlyGoingPct: string;
  avgWorkDisplay: string;
};

export type BioReportFilters = { from: string; to: string; empId?: number | null; status?: string | null; minPunches?: number; page?: number; pageSize?: number };

export const getEmployees = () => client.get<{ success: boolean; employees: EmployeeOption[] }>('/admin/biometric-report/employees');

export const getReport = (params: BioReportFilters) =>
  client.get<{ success: boolean; rows: BiometricReportRow[]; total: number; page: number; pageSize: number; kpi: BioReportKpi }>('/admin/biometric-report', { params });

export type MergedPunch = { time: string; source: 'device' | 'correction' };

export const getPunches = (empId: number, date: string) =>
  client.get<{ success: boolean; punches: MergedPunch[] }>('/admin/biometric-report/punches', { params: { empId, date } });

export const saveCorrection = (empId: number, date: string, times: string[]) =>
  client.post<{ success: boolean; message: string }>('/admin/biometric-report/correction', { empId, date, times });

export type BioPartialRow = {
  employeeId: number;
  empCode: string;
  empName: string;
  bioCode: string;
  date: string;
  deviceCount: number;
  correctionCount: number;
  totalCount: number;
  firstPunch: string;
};

export const getPartial = (params: { from: string; to: string; empId?: number | null; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; rows: BioPartialRow[]; total: number; page: number; pageSize: number }>('/admin/biometric-report/partial', { params });

export const getPartialPunches = (empId: number, date: string) =>
  client.get<{ success: boolean; punches: MergedPunch[] }>('/admin/biometric-report/partial-punches', { params: { empId, date } });

export const savePartialCorrection = (empId: number, date: string, correctionTimes: string[], remarks: string) =>
  client.post<{ success: boolean; message: string }>('/admin/biometric-report/partial-correction', { empId, date, correctionTimes, remarks });
