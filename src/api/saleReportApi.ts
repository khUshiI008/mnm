import client from './client';

export type SaleReportMode = 'today' | 'yesterday' | 'week' | 'month' | 'mtd' | 'custom';
export type SaleReportViewMode = 'day' | 'item';
export type SaleReportSortBy = 'date_desc' | 'date_asc' | 'bill' | 'amt_desc' | 'amt_asc' | 'qty_desc' | 'qty_asc';

export type ScopeOption = { id: number; label: string };
export type ScopeOptionChecked = ScopeOption & { checked: boolean };

export type SaleReportScopeResponse = {
  success: boolean;
  configured: boolean;
  brands: ScopeOption[];
  departments: ScopeOption[];
};

export type BillRow = {
  date: string;
  billNo: string;
  timeStr: string;
  brand: string | null;
  dept: string | null;
  article: string | null;
  itemCode: string | null;
  category: string | null;
  color: string | null;
  size: string | null;
  qty: number;
  mrp: number;
  discount: number;
  amount: number;
  isReturn: boolean;
};

export type DayGroup = {
  date: string;
  billCount: number;
  qty: number;
  amt: number;
  bills: BillRow[];
};

export type ItemRow = {
  article: string | null;
  itemCode: string | null;
  color: string | null;
  size: string | null;
  brand: string | null;
  category: string | null;
  dept: string | null;
  qty: number;
  mrpTotal: number;
  discTotal: number;
  amtTotal: number;
  billCount: number;
};

export type SaleReportSummary = {
  billCount: number;
  returnRowCount: number;
  totQty: number;
  totAmt: number;
  totMrp: number;
  totDisc: number;
  totReturnAmt: number;
  totReturnQty: number;
  avgDiscPct: number;
  avgDiscAmt: number;
  calcCheck: boolean;
};

export type SaleReportResponse = {
  success: boolean;
  configured: boolean;
  mode?: SaleReportMode;
  from?: string;
  to?: string;
  periodLabel?: string;
  spanDays?: number;
  viewMode?: SaleReportViewMode;
  sortBy?: SaleReportSortBy;
  scope?: { brands: ScopeOptionChecked[]; departments: ScopeOptionChecked[] };
  summary?: SaleReportSummary | null;
  days?: DayGroup[];
  items?: ItemRow[];
};

export type SaleReportParams = {
  mode: SaleReportMode;
  from?: string;
  to?: string;
  viewMode: SaleReportViewMode;
  sortBy: SaleReportSortBy;
  search?: string;
  brandIds?: string;
  deptIds?: string;
};

export const getSaleReportScope = () => client.get<SaleReportScopeResponse>('/sale-report/scope');

export const getSaleReport = (params: SaleReportParams) => client.get<SaleReportResponse>('/sale-report', { params });
