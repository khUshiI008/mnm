import client from './client';

export type FilterOption = { id: string; label: string };

export type StockFiltersResponse = {
  success: boolean;
  branches: FilterOption[];
  sessions: FilterOption[];
  brandNames: string[];
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
  brandNames?: string[];
};

export type StockSearchParams = {
  itemName: string;
  fromDt: string;
  toDt: string;
  branchIds?: string;
  sessionIds?: string;
};

export const getStockCheckFilters = () => client.get<StockFiltersResponse>('/stock-check/filters');

export const searchStock = (params: StockSearchParams) => client.get<StockSearchResponse>('/stock-check/search', { params });
