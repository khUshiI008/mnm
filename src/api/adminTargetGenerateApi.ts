import client from './client';

export type PickerOption = { id: number; name: string };

export type TargetGridItem = {
  salesTargetId: number;
  targetName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isClosed: boolean;
  status: 'Active' | 'Closed';
  managerTargetMode: 'Single' | 'Multiple';
  weekStartDay: string;
  weeklyTargetValue: number;
  weeklyTargetQty: number;
  salesScope: 'Personal' | 'Overall';
  isActive: boolean;
  targetType: 'Value' | 'Qty' | 'Both';
  brandNames: string[];
  departments: PickerOption[];
  branches: PickerOption[];
  employees: PickerOption[];
  managers: PickerOption[];
  employeeCount: number;
  managerCount: number;
};

export type DayRow = { day: string; valueMultiplier: number; qtyMultiplier: number; valueReward: number; qtyReward: number };
export type SlabRow = { achievementPct: number; valueReward: number; qtyReward: number };

export type TargetDetail = {
  salesTargetId: number;
  targetName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  managerTargetMode: 'Single' | 'Multiple';
  weekStartDay: string;
  weeklyTargetValue: number;
  weeklyTargetQty: number;
  days: DayRow[];
  qtyRewardPerPcs: number;
  salesScope: 'Personal' | 'Overall';
  monthlyTargetValue: number | null;
  monthlyTargetQty: number | null;
  rewardPoolValue: number | null;
  rewardPoolQty: number | null;
  isActive: boolean;
  brandIds: number[];
  departmentIds: number[];
  branchIds: number[];
  employeeIds: number[];
  managerIds: number[];
  slabs: SlabRow[];
  managerSlabs: SlabRow[];
};

export type TargetPayload = Omit<TargetDetail, 'salesTargetId' | 'isActive' | 'effectiveTo'> & {
  // Set only when saving from the "New Target from this" flow — the id of
  // the target being closed out. The server rejects a new EffectiveFrom
  // that isn't strictly after that source target's own EffectiveFrom.
  duplicateFromId?: number;
};

export const getTargets = () => client.get<{ success: boolean; targets: TargetGridItem[] }>('/admin/sales-target');

export const getTargetLookups = () =>
  client.get<{ success: boolean; brands: PickerOption[]; departments: PickerOption[]; branches: PickerOption[] }>('/admin/sales-target/lookups');

export const getTarget = (id: number) => client.get<{ success: boolean; target: TargetDetail }>(`/admin/sales-target/${id}`);

export const createTarget = (payload: TargetPayload) =>
  client.post<{ success: boolean; salesTargetId?: number; salesTargetIds?: number[]; message?: string; errors?: string[] }>('/admin/sales-target', payload);

export const updateTarget = (id: number, payload: TargetPayload) =>
  client.put<{ success: boolean; salesTargetId?: number; salesTargetIds?: number[]; message?: string; errors?: string[] }>(`/admin/sales-target/${id}`, payload);

export const deleteTarget = (id: number) => client.delete<{ success: boolean }>(`/admin/sales-target/${id}`);

// Barcode Target (its own standalone page/module, Panel/Sales/BarcodeTarget) and Sold
// Barcode Payments live in adminBarcodeTargetApi.ts / soldBarcodePaymentsApi.ts instead.
