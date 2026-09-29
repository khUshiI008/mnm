import client from './client';

export type PerfCategory = { id: string; title: string; icon: string; color: string };

export type PerfFilterOptions = { categories: PerfCategory[]; departments: { id: number; name: string }[]; locations: { id: number; name: string }[] };

export type PerfSummary = {
  employees: number;
  calendarDays: number;
  avgAttendancePct: number;
  totalAbsent: number;
  totalLate: number;
  totalEarly: number;
  periodFrom: string;
  periodTo: string;
  categoryLabel: string;
};

export type PerfEmpRow = { rank: number; employeeId: number; code: string; name: string; dept: string; location: string; value: number; attPct: number; badge: [string, string] };

export type PerfEmpSection = { id: string; color: string; icon: string; title: string; sub: string; valueLabel: string; isPercent: boolean; isDecimal: boolean; rows: PerfEmpRow[] };

export type PerfDeptRow = { rank: number; dept: string; empCount: number; value: number; attPct: number };

export type PerfDeptSection = { id: string; color: string; icon: string; title: string; valueLabel: string; isPercent: boolean; rows: PerfDeptRow[] };

export const getFilters = () => client.get<{ success: boolean } & PerfFilterOptions>('/admin/performance/filters');

export const generateReport = (params: { from: string; to: string; deptId?: number | null; locId?: number | null; maxN?: number; category?: string | null }) =>
  client.get<{ success: boolean; summary: PerfSummary; employeeSections: PerfEmpSection[]; departmentSections: PerfDeptSection[] }>('/admin/performance', { params });

export type PerfDeptDrilldown = {
  success: boolean;
  dept: string;
  categoryId: string;
  categoryTitle: string;
  valueLabel: string;
  isPercent: boolean;
  isDecimal: boolean;
  rows: PerfEmpRow[];
};

export const getDeptDrilldown = (params: { from: string; to: string; locId?: number | null; category: string; dept: string }) =>
  client.get<PerfDeptDrilldown>('/admin/performance/dept-drilldown', { params });
