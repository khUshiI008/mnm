import client from './client';

export type FilterOption = { id: string; label: string };

export type BrandOption = { id: number; name: string };

// Scope DTO shape shared with the Sale Report screen's now-fixed scope
// block (see partyBalanceStockService.js's buildScopeDto). PRIVACY: once
// hideBrandName is true, brandOptions is always empty — the server never
// sends real Brand names to a masked Party — and extraDescOptions carries
// the read-only labels to show instead.
export type BalanceStockScope = {
  displayName: string;
  hideBrandName: boolean;
  brandOptions: BrandOption[];
  extraDescOptions: string[];
};

export type BalanceStockFiltersResponse = {
  success: boolean;
  branches: FilterOption[];
  sessions: FilterOption[];
  scope: BalanceStockScope;
  fixedFrom: string;
};

export type BalanceStockRow = {
  branch: string | null;
  articleNo: string | null;
  color: string | null;
  size: string | null;
  category: string | null;
  dept: string | null;
  firstPurchase: string;
  lastPurchase: string;
  barcode: string;
  open: string;
  purc: string;
  stockIn: string;
  stockOut: string;
  purcRet: string;
  sale: string;
  saleRet: string;
  netSale: string;
  qBal: string;
  salePct: number | null;
};

export type BalanceStockReportResponse = {
  success: boolean;
  message?: string;
  rows: BalanceStockRow[];
  scope: BalanceStockScope;
  asOf: string;
  fromDt: string;
};

export const getBalanceStockFilters = () => client.get<BalanceStockFiltersResponse>('/party/balance-stock/filters');

export const getBalanceStockReport = (params: { branchIds?: string[]; sessionIds?: string[]; brandIds?: number[] }) =>
  client.post<BalanceStockReportResponse>('/party/balance-stock/report', params);
