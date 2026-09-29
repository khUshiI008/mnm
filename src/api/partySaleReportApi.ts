import client from './client';

export type SaleReportFilters = {
  periodMode?: 'today' | 'yesterday' | 'week' | 'month' | 'mtd' | 'custom';
  from?: string;
  to?: string;
  viewMode?: 'item' | 'day';
  sort?: string;
  search?: string;
  brandIds?: number[];
  departmentNames?: string[];
  categories?: string[];
  colors?: string[];
  sizes?: string[];
  articles?: string[];
  billNos?: string[];
};

export type SaleReportSummary = {
  billCount: number;
  totQty: number;
  totAmt: number;
  calcCheck: boolean;
  totMrp: number;
  totDisc: number;
  avgBillAmt: number;
  avgQtyPerBill: number;
  avgDiscPerBill: number;
  hasReturns: boolean;
  totReturnQty: number;
  totReturnAmt: number;
  avgDiscAmt: number;
  avgDiscPct: number;
};

export type SaleReportItemRow = {
  articleNo: string;
  itemCode: string;
  color: string;
  size: string;
  brand: string;
  category: string;
  dept: string;
  billCount: number;
  qty: number;
  mrpTotal: number;
  discTotal: number;
  amtTotal: number;
};

export type SaleReportBillLine = {
  articleNo: string;
  itemCode: string;
  color: string;
  size: string;
  category: string;
  dept: string;
  brand: string;
  qty: number;
  mrp: number;
  discount: number;
  amount: number;
};

export type SaleReportDayRow = {
  billNo: string;
  date: string;
  amount: number;
  qty: number;
  lines: SaleReportBillLine[];
};

export type SaleReportResponse = {
  success: boolean;
  viewMode: 'item' | 'day';
  periodMode: string;
  from: string;
  to: string;
  earliestAllowedDate: string;
  summary: SaleReportSummary;
  rows: (SaleReportItemRow | SaleReportDayRow)[];
  filterOptions: {
    departments: string[];
    categories: string[];
    colors: string[];
    sizes: string[];
    articles: string[];
    billNos: string[];
  };
  scope: {
    displayName: string;
    hideBrandName: boolean;
    // Empty (never populated with real names) when hideBrandName is true —
    // the server withholds the Party's real Brand names entirely in that
    // case. extraDescOptions carries the read-only labels to show instead.
    brandOptions: { id: number; name: string }[];
    extraDescOptions: string[];
  };
};

export const getSaleReport = (filters: SaleReportFilters) => client.post<SaleReportResponse>('/party/sale-report', filters);
