import client from './client';

export type FilterOption = { id: string; label: string };

export type BrandOption = { id: number; name: string };

export type StockFiltersResponse = {
  success: boolean;
  branches: FilterOption[];
  sessions: FilterOption[];
  scope: { displayName: string; hideBrandName: boolean };
  // Brand checklist (StockCheck.aspx.cs's cblBrands), defaulting to every
  // item checked. Empty when the Party's scope.hideBrandName is true — the
  // server withholds real Brand names entirely in that case (privacy rule,
  // see partyScopeService.js) — extraDescOptions carries the read-only
  // labels to show instead.
  brandOptions: BrandOption[];
  extraDescOptions: string[];
};

export type SizeRow = {
  size: string;
  open: string;
  purc: string;
  stockIn: string;
  stockOut: string;
  purcRet: string;
  sale: string;
  saleRet: string;
  netSale: string;
  qBal: string;
  barcode: string;
  salePct: number | null;
};

export type StockRow = {
  sr: number;
  branch: string | null;
  itemName: string | null;
  color: string | null;
  type: string | null;
  category: string | null;
  firstPurchase: string;
  lastPurchase: string;
  sizes: SizeRow[];
};

export type StockSearchResponse = {
  success: boolean;
  message?: string;
  rows: StockRow[];
  scope?: { displayName: string; hideBrandName: boolean };
};

export type StockSearchParams = {
  itemName: string;
  fromDt: string;
  toDt: string;
  branchIds?: string;
  sessionIds?: string;
  // Omitted -> the Party's full Brand allocation (default all-checked,
  // matching the .NET picker's untouched state). An explicit empty array is
  // rejected server-side ("Select at least one Brand...").
  brandIds?: number[];
};

export const getStockCheckFilters = () => client.get<StockFiltersResponse>('/party/stock-check/filters');

export const searchStock = (params: StockSearchParams) => client.post<StockSearchResponse>('/party/stock-check/search', params);
