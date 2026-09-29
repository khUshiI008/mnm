import client from './client';

// Node port of Employee/BarcodeWiseEarned.aspx — one row per sale line that
// earned Barcode Target commission (as Employee, or as Manager on a team sale).
export type BarcodeEarnedRow = {
  billDate: string; // yyyy-MM-dd
  billNo: string;
  itemCode: string;
  articleNo: string | null;
  brand: string | null;
  description: string | null;
  color: string | null;
  size: string | null;
  qty: number;
  role: 'Employee' | 'Manager';
  soldBy: string | null; // Manager rows only — which team member made the sale
  targetId: number;
  targetLabel: string;
  rate: number;
  earned: number;
  paid: boolean;
  paidDate: string | null;
  paidBy: string | null;
};

export type BarcodeEarnedResponse = {
  success: boolean;
  dateFrom: string;
  dateTo: string;
  isEmployeeAnywhere: boolean;
  isManagerAnywhere: boolean;
  rows: BarcodeEarnedRow[];
};

export const getBarcodeEarned = (params?: { from?: string; to?: string }) =>
  client.get<BarcodeEarnedResponse>('/sales-target/barcode-earned', { params, timeout: 60000 });

export const getBarcodeEarnedStatus = () => client.get<{ success: boolean; configured: boolean }>('/sales-target/barcode-earned/status');
