import client from './client';

/** One employee row in Scanner App Access (who may log in to the aScanner app). */
export type ScannerAccessEmployee = {
  employeeId: number;
  code: string;
  name: string;
  mobile: string;
  status: string;
  department: string;
  designation: string;
  location: string;
  organization: string;
  assigned: boolean;
};

export const getScannerAccess = () => client.get<{ success: boolean; employees: ScannerAccessEmployee[] }>('/admin/scanner-access');

/** Replaces the whole access list. */
export const saveScannerAccess = (employeeIds: number[]) =>
  client.put<{ success: boolean; count: number }>('/admin/scanner-access', { employeeIds });
