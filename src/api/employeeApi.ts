import client from './client';

export type EmployeeListItem = {
  employeeId: number;
  code: string;
  biometricMachineCode: string;
  employeeName: string;
  displayName: string;
  profilePictureUrl: string | null;
  departmentName: string;
  designationName: string;
  employmentTypeName: string;
  weekOffCompensation: string;
  generatePayroll: boolean;
  employmentStatus: string;
  mobileNo: string;
  currentShiftName: string;
};

export type EmployeeDetail = {
  employeeId: number;
  code: string;
  biometricMachineCode: string;
  employeeName: string;
  displayName: string;
  mobileNo: string;
  brandMobileNo: string;
  email: string;
  gender: string;
  dateOfBirth: string | null;
  maritalStatus: string;
  anniversaryDate: string | null;
  salesSalespersonId: number | null;
  organizationId: number;
  locationId: number;
  inhouseLookupId: number | null;
  departmentLookupId: number | null;
  designationLookupId: number | null;
  employmentTypeLookupId: number | null;
  salaryTypeLookupId: number | null;
  employeeTypeLookupId: number | null;
  salary: number;
  dateOfJoining: string | null;
  weekOffCompensation: string;
  generatePayroll: boolean;
  bankName: string;
  ifscCode: string;
  accountNo: string;
  brandIds: number[];
  deptIds: number[];
};

export type LookupOption = { lookupId: number; name: string };
export type LookupOptions = {
  organizations: { organizationId: number; name: string }[];
  locations: { locationId: number; name: string }[];
  departments: LookupOption[];
  designations: LookupOption[];
  employmentTypes: LookupOption[];
  salaryTypes: LookupOption[];
  employeeTypes: LookupOption[];
  inhouseTypes: LookupOption[];
  salesStaff: { salesSalespersonId: number; name: string }[];
  brands: { salesBrandId: number; name: string }[];
  depts: { salesDepartmentId: number; name: string }[];
};

export const getEmployees = (params: { page?: number; pageSize?: number; search?: string; sortCol?: string; sortDir?: 'asc' | 'desc'; status?: string }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; employees: EmployeeListItem[] }>('/admin/employees', { params });

export const getEmployee = (id: number) => client.get<{ success: boolean; employee: EmployeeDetail }>(`/admin/employees/${id}`);

export const getLookupOptions = () => client.get<{ success: boolean } & LookupOptions>('/admin/employees/lookup-options');

export type EmployeeFormPayload = Omit<EmployeeDetail, 'employeeId'>;

export const createEmployee = (payload: EmployeeFormPayload) =>
  client.post<{ success: boolean; employeeId: number; message: string }>('/admin/employees', payload);

export const updateEmployee = (id: number, payload: EmployeeFormPayload) =>
  client.put<{ success: boolean; employeeId: number; message: string }>(`/admin/employees/${id}`, payload);

export const deleteEmployee = (id: number) => client.delete<{ success: boolean; message: string }>(`/admin/employees/${id}`);

// Lightweight, freely reversible status change — separate from the full edit
// form and from delete/archive. "Trial" deliberately isn't offered here; it's
// only ever set at registration time, never something to manually revert to.
export const EMPLOYMENT_STATUS_OPTIONS = ['Active', 'Inactive', 'Left', 'Terminated'] as const;
export type EmploymentStatusOption = (typeof EMPLOYMENT_STATUS_OPTIONS)[number];

// Separate from EMPLOYMENT_STATUS_OPTIONS above — this one's for the list's
// filter chips (search/browse), where "Trial" is a valid thing to look up
// even though it's not something you can manually switch an employee back to.
export const EMPLOYEE_STATUS_FILTER_OPTIONS = ['Active', 'Trial', 'Inactive', 'Left', 'Terminated'] as const;

export const updateEmployeeStatus = (id: number, status: EmploymentStatusOption) =>
  client.post<{ success: boolean; message: string }>(`/admin/employees/${id}/status`, { status });

export type QuickEditPayload = {
  salary?: number | null;
  designationLookupId?: number | null;
  departmentLookupId?: number | null;
  employeeTypeLookupId?: number | null;
};
export type QuickEditResult = {
  employeeId: number;
  salary: number | null;
  designationLookupId: number | null;
  designationName: string | null;
  departmentLookupId: number | null;
  departmentName: string | null;
  employeeTypeLookupId: number | null;
  employeeTypeName: string | null;
};

/** Lightweight Salary/Designation/Department fixer — not the full Add/Edit form, see backend employeeController.quickEditFields. */
export const quickEditEmployee = (id: number, payload: QuickEditPayload) =>
  client.post<{ success: boolean; message: string; employee: QuickEditResult }>(`/admin/employees/${id}/quick-edit`, payload);

export const quickAddLookup = (masterType: string, name: string, description?: string) =>
  client.post<{ success: boolean; lookupId: number; name: string }>('/admin/employees/lookups/quick-add', { masterType, name, description });
