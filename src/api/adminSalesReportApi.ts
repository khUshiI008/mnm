import client from './client';

export type FilterOption = { value: string; label: string };

export type SalesReportFilterOptions = {
  salespersons: FilterOption[];
  branches: FilterOption[];
  categories: FilterOption[];
  departments: FilterOption[];
  sessions: FilterOption[];
  brands: FilterOption[];
};

export type SalesReportFilters = {
  fromDt: string;
  toDt: string;
  salesPerson?: string;
  brand?: string;
  branchId?: string;
  category?: string;
  department?: string;
  session?: string;
};

export type SalesTransactionRow = {
  cashmemoDt: string;
  cashmemoNo: string;
  branchName: string;
  salesPersonName: string;
  invDepartmentName: string;
  invCategoryName: string;
  brand: string;
  articleNo: string;
  color: string;
  size: string;
  quantity: number;
  mrpValue: number;
  discountAmt: number;
  netAmount: number;
};

export type SalesReportStats = {
  netAmt: number;
  mrpVal: number;
  discount: number;
  branches: number;
  persons: number;
  minDt: string | null;
  maxDt: string | null;
  syncedOn: string | null;
};

export const getSalesReportFilterOptions = () =>
  client.get<{ success: boolean } & SalesReportFilterOptions>('/admin/sales-report/filter-options');

export const getSalesReportGrid = (filters: SalesReportFilters) =>
  client.get<{ success: boolean; totalCount: number; rows: SalesTransactionRow[]; stats: SalesReportStats | null }>('/admin/sales-report/grid', {
    params: filters,
  });

export const syncSalesReport = (filters: SalesReportFilters) =>
  client.post<{ success: boolean; message: string }>('/admin/sales-report/sync', filters, { timeout: 180000 });
