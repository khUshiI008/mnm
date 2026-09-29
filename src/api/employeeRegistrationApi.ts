import client from './client';

export type PendingRegistration = {
  employeeId: number;
  code: string;
  employeeName: string;
  mobileNo: string;
  email: string | null;
  gender: string;
  dobDisplay: string;
  orgName: string;
  locName: string;
  deptName: string;
  registeredOn: string;
};

export const getRegistrations = (params: { page?: number; pageSize?: number; search?: string }) =>
  client.get<{ success: boolean; page: number; totalPages: number; total: number; registrations: PendingRegistration[] }>(
    '/admin/employee-registrations',
    { params }
  );

export const approveRegistration = (employeeId: number) =>
  client.post<{ success: boolean; message: string }>(`/admin/employee-registrations/${employeeId}/approve`);

export const rejectRegistration = (employeeId: number) =>
  client.post<{ success: boolean; message: string }>(`/admin/employee-registrations/${employeeId}/reject`);
