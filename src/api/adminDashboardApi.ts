import client from './client';

export type DeptEmpItem = { employeeId: number; name: string; sub: string; designation?: string };
export type DeptSection = {
  deptName: string;
  total: number;
  onLeave: number;
  absent: number;
  totalEmps: DeptEmpItem[];
  onLeaveEmps: DeptEmpItem[];
  absentEmps: DeptEmpItem[];
};

export type DashboardKpis = {
  totalEmployees: number;
  bioTotal: number;
  arrivedToday: number;
  attendancePct: number;
  currentlyWorking: number;
  missedPunchToday: number;
  onBreak: number;
  notYetCome: number;
  onLeave: number;
  noBioConfigured: number;
  highPunchers: number;
  lateComing: number;
  earlyGoing: number;
  halfDay: number;
  excessBreak: number;
  monthPayroll: number;
  overdueCount: number;
  overdueAmount: number;
};

export type EmploymentStatusCounts = {
  active: number;
  inactive: number;
  left: number;
  terminated: number;
};

export type DashboardResponse = {
  success: boolean;
  selectedDate: string;
  earlyGoingDate: string;
  kpis: DashboardKpis;
  deptSections: DeptSection[];
  employmentStatusCounts: EmploymentStatusCounts;
  lists: Record<string, any[]>;
};

export const getDashboard = (date?: string) => client.get<DashboardResponse>('/admin/dashboard', { params: date ? { date } : {} });

export type MissedPunchEmployee = {
  empId: number;
  empCode: string;
  empName: string;
  bioCode: string;
  punches: { time: string; type: 'in' | 'out' | 'unmatched' }[];
};

export type MissedPunchDateGroup = {
  date: string;
  dateLabel: string;
  count: number;
  employees: MissedPunchEmployee[];
};

export const getMissedPunches = (month?: string) =>
  client.get<{ success: boolean; month: string; totalDates: number; totalEmployees: number; dates: MissedPunchDateGroup[] }>(
    '/admin/dashboard/missed-punches',
    { params: month ? { month } : {} }
  );

export type StaffCategory = 'Inhouse' | 'Brand Staff' | 'Other';

export type EmployeeBreakdownMember = {
  employeeId: number;
  code: string;
  name: string;
  salary: number | null;
  designationLookupId: number | null;
  departmentLookupId: number | null;
  departmentName: string | null;
  employeeTypeLookupId: number | null;
  employeeTypeName: string | null;
};
export type EmployeeBreakdownGroup = {
  designationId: number | 'unspecified';
  designationLabel: string;
  headcount: number;
  totalSalary: number;
  employees: EmployeeBreakdownMember[];
};
export type EmployeeBreakdownCategory = {
  category: StaffCategory;
  totalEmployees: number;
  totalSalary: number;
  groups: EmployeeBreakdownGroup[];
};

export const getEmployeeBreakdown = () =>
  client.get<{ success: boolean; totalEmployees: number; totalSalary: number; categories: EmployeeBreakdownCategory[] }>(
    '/admin/dashboard/employee-breakdown'
  );

export const getOverdueReceivables = () =>
  client.get<{ success: boolean; totalCount: number; totalAmount: number; items: any[] }>('/admin/dashboard/overdue-receivables');

export type BreakSelfie = {
  url: string;
  breakNumber: number;
  isExcess: boolean;
  capturedAt: string | null;
  hasLocation: boolean;
  latitude: number | null;
  longitude: number | null;
};

export const getEmployeeSelfies = (employeeId: number, date?: string) =>
  client.get<{ success: boolean; found: boolean; employeeName: string; dateDisplay?: string; selfies: BreakSelfie[] }>(
    '/admin/dashboard/employee-selfies',
    { params: date ? { employeeId, date } : { employeeId } }
  );

export type CheckInSelfie = {
  url: string;
  capturedAt: string | null;
  hasLocation: boolean;
  latitude: number | null;
  longitude: number | null;
};

export const getEmployeeCheckInSelfie = (employeeId: number, date?: string) =>
  client.get<{ success: boolean; found: boolean; employeeName: string; dateDisplay?: string; selfie: CheckInSelfie | null }>(
    '/admin/dashboard/employee-checkin-selfie',
    { params: date ? { employeeId, date } : { employeeId } }
  );

export type EmployeePhotoInfo = {
  profilePictureUrl: string | null;
  checkIn: CheckInSelfie | null;
};

/** Bulk lookup (profile picture + today's check-in selfie) for a list of employeeIds — backs DrillDownListScreen's "Arrived Today" avatars, one call for the whole list instead of one per row. */
export const getEmployeePhotos = (employeeIds: number[], date?: string) =>
  client.get<{ success: boolean; employees: Record<number, EmployeePhotoInfo> }>('/admin/dashboard/employee-photos', {
    params: { employeeIds: employeeIds.join(','), ...(date ? { date } : {}) },
  });
