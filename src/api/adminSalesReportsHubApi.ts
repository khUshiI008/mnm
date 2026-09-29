import client from './client';

export type SalesReportType = 'dimension' | 'trend' | 'progress' | 'comparison';
export type SalesReportValueType = 'currency' | 'count';

export type SalesReportDef = {
  key: string;
  title: string;
  type: SalesReportType;
  valueType: SalesReportValueType;
};

export const getSalesReportsCatalog = () => client.get<{ success: boolean; reports: SalesReportDef[] }>('/admin/sales-reports/catalog');

export type SalesReportSegment = {
  label: string;
  value: number;
  qty?: number;
  dateKey?: string;
  // Which department(s) this row's sales came from, biggest first — present on
  // dimension-report rows (except Department wise Sale itself) and row-detail items.
  departments?: string[];
  // Row-detail (article) items only.
  articleNo?: string;
  brand?: string;
  brandName?: string; // raw Brand as sold — identifies the Brand for "Request picture"
  color?: string;
  size?: string;
  imageUrl?: string | null;
};

export type SalesComparisonPeriod = 'day' | 'week' | 'month' | 'year';

export type WeeklyComparisonRow = {
  weekNum: number;
  rangeLabel: string;
  value: number;
  qty: number;
  pctChange: number | null;
  vsWeekNum: number | null;
  isCurrent: boolean;
};

export type SalesReportData = {
  success: boolean;
  title: string;
  valueType: SalesReportValueType;
  chartHint?: 'trend';
  periodType?: SalesComparisonPeriod;
  fromDt: string;
  toDt: string;
  total: number;
  totalQty?: number;
  segments: SalesReportSegment[];
  // Only present when periodType === 'week' — a cascading newest-first list
  // (this week vs last week, that vs the one before, ...) the detail screen
  // renders as dedicated comparison cards instead of the generic bar chart.
  weeklyRows?: WeeklyComparisonRow[];
  pctChange?: number | null;
};

export const getSalesReport = (key: string, params?: { fromDt?: string; toDt?: string; month?: string; periodType?: SalesComparisonPeriod; dept?: string }) =>
  client.get<SalesReportData>(`/admin/sales-reports/${key}`, { params });

export const getSalesReportDepartments = () => client.get<{ success: boolean; departments: string[] }>('/admin/sales-reports/departments');

export type RowDetailData = {
  success: boolean;
  title: string;
  fromDt: string;
  toDt: string;
  total: number;
  totalQty: number;
  segments: SalesReportSegment[];
};

// Tap a row on any dimension-style report (SalesPerson wise, Category wise,
// ...) to see which articles/colors/sizes it's actually made of.
export const getSalesReportRowDetail = (key: string, value: string, params?: { fromDt?: string; toDt?: string; dept?: string }) =>
  client.get<RowDetailData>(`/admin/sales-reports/${key}/detail`, { params: { ...params, value } });

// Article has no picture yet — notifies the employees allocated to its Brand
// to upload one. 409 if it already has a picture or was requested recently.
export const requestArticlePicture = (body: { articleNo: string; brandName: string; color?: string }) =>
  client.post<{ success: boolean; notified: number; message?: string }>('/admin/sales-reports/article-picture-request', body);

export type DayBillItem ={ cashmemoNo: string; branchName: string; salesPerson: string; value: number; qty: number; departments?: string[] };

export type DayBillSequenceData = {
  success: boolean;
  title: string;
  date: string;
  count: number;
  totalValue: number;
  totalQty: number;
  items: DayBillItem[];
};

// Tap a day on Sale Trend Time Wise — that day's bills in bill-sequence
// order (no real clock time exists in this data, see the backend's own doc
// comment on getDayBillSequence for why CashmemoNo order is the closest proxy).
export const getTrendDayBills = (date: string, params?: { dept?: string }) =>
  client.get<DayBillSequenceData>('/admin/sales-reports/trend-day-bills', { params: { ...params, date } });
