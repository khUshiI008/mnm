import client from './client';

export type SoldBarcodeRow = {
  rowKey: string;
  barcodeTargetId: number;
  targetActive: boolean;
  billNo: string;
  itemCode: string;
  billDate: string;
  qty: number;
  employee: { id: number; name: string } | null;
  employeeEarned: number;
  employeePaid: boolean;
  employeePaidDate: string | null;
  employeePaidBy: string | null;
  managers: { id: number; name: string }[];
  managerEarned: number;
  managerPaid: boolean;
  managerPaidDate: string | null;
  managerPaidBy: string | null;
};

export type SoldBarcodeListResponse = {
  success: boolean;
  rows: SoldBarcodeRow[];
  total: number;
  page: number;
  pageSize: number;
  totalEmployeeEarned: number;
  totalManagerEarned: number;
  // Every row's key across ALL pages of the current filter — pass back into
  // bulkMarkSoldBarcode for "Mark All Paid/Unpaid" over the full filtered
  // set, not just the visible page.
  filteredRowKeys: string[];
};

export type SoldBarcodeFilters = {
  from?: string;
  to?: string;
  employeeId?: number;
  managerId?: number;
  search?: string;
  page?: number;
};

export const getSoldBarcodePayments = (filters: SoldBarcodeFilters) =>
  client.get<SoldBarcodeListResponse>('/admin/sold-barcode-payments', { params: filters });

export const markSoldBarcodePaid = (rowKey: string, role: 'Employee' | 'Manager') =>
  client.post<{ success: boolean; amount?: number; code?: string; message?: string }>('/admin/sold-barcode-payments/mark-paid', { rowKey, role });

// No per-row "unmark" in the .NET reference either — only exposed here for the bulk action to call per row.
export const unmarkSoldBarcodePaid = (rowKey: string, role: 'Employee' | 'Manager') =>
  client.post<{ success: boolean }>('/admin/sold-barcode-payments/unmark-paid', { rowKey, role });

export const bulkMarkSoldBarcode = (rowKeys: string[], action: 'pay' | 'unpay') =>
  client.post<{ success: boolean; paidCount?: number; alreadyCount?: number; skipCount?: number; unpaidCount?: number }>('/admin/sold-barcode-payments/bulk', {
    rowKeys,
    action,
  });
