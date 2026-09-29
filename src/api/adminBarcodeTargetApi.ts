import client from './client';
import { PickerOption } from './adminTargetGenerateApi';

export type BarcodeTargetGridItem = {
  barcodeTargetId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isClosed: boolean;
  status: 'Active' | 'Closed';
  pcsAmount: number;
  managerPcsAmount: number | null;
  brandNames: string[];
  employees: PickerOption[];
  managers: PickerOption[];
  barcodeCount: number;
  conflictCount: number;
};

export type BarcodeRow = {
  id: number;
  barcodeNumber: string;
  pcsAmount: number | null;
  managerPcsAmount: number | null;
  effectivePcsAmount: number | null;
  effectiveManagerPcsAmount: number | null;
};

export type BarcodeTargetDetail = {
  barcodeTargetId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  pcsAmount: number;
  managerPcsAmount: number | null;
  brandIds: number[];
  employeeIds: number[];
  managerIds: number[];
  barcodes: BarcodeRow[];
};

export type ConflictRow = { id: number; barcodeNumber: string; pcsAmount: number | null; managerPcsAmount: number | null };

export type BarcodeTargetPayload = {
  brandIds: number[];
  employeeIds: number[];
  managerIds: number[];
  pcsAmount: number;
  managerPcsAmount?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export type PickedFile = { uri: string; name: string; type: string };

type CreateOrUpdateResponse = {
  success: boolean;
  barcodeTargetId?: number;
  barcodeCount?: number;
  conflictCount?: number;
  brandCount?: number;
  employeeCount?: number;
  managerCount?: number;
  message?: string;
  // All-conflict case (create only) — no target was created at all.
  allConflict?: boolean;
  conflicts?: ConflictRow[];
  errors?: string[];
};

function buildForm(payload: BarcodeTargetPayload, file?: PickedFile | null) {
  const form = new FormData();
  form.append('brandIds', payload.brandIds.join(','));
  form.append('employeeIds', payload.employeeIds.join(','));
  form.append('managerIds', payload.managerIds.join(','));
  form.append('pcsAmount', String(payload.pcsAmount));
  if (payload.managerPcsAmount != null) form.append('managerPcsAmount', String(payload.managerPcsAmount));
  form.append('effectiveFrom', payload.effectiveFrom);
  if (payload.effectiveTo) form.append('effectiveTo', payload.effectiveTo);
  if (file) {
    form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as any);
  }
  return form;
}

export const getBarcodeTargets = () => client.get<{ success: boolean; targets: BarcodeTargetGridItem[] }>('/admin/sales-target/barcode');

export const getBarcodeTarget = (id: number) => client.get<{ success: boolean; target: BarcodeTargetDetail }>(`/admin/sales-target/barcode/${id}`);

export const createBarcodeTarget = (payload: BarcodeTargetPayload, file: PickedFile) =>
  client.post<CreateOrUpdateResponse>('/admin/sales-target/barcode', buildForm(payload, file), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

// File is optional on update — the .NET reference lets an admin edit
// brands/employees/managers/rates without re-uploading the barcode list.
export const updateBarcodeTarget = (id: number, payload: BarcodeTargetPayload, file?: PickedFile | null) =>
  client.put<CreateOrUpdateResponse>(`/admin/sales-target/barcode/${id}`, buildForm(payload, file), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

export const deleteBarcodeTarget = (id: number) => client.delete<{ success: boolean }>(`/admin/sales-target/barcode/${id}`);

export const getBarcodeConflicts = (id: number) => client.get<{ success: boolean; conflicts: ConflictRow[] }>(`/admin/sales-target/barcode/${id}/conflicts`);

// "Proceed with Conflict" — only adds newly-genuine rows from a corrected re-upload.
export const resolveBarcodeConflict = (id: number, file: PickedFile) => {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as any);
  return client.post<{ success: boolean; addedCount?: number; stillConflictingCount?: number; message?: string; errors?: string[] }>(
    `/admin/sales-target/barcode/${id}/proceed-conflict`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
  );
};

// Direct edit of one barcode's own rate override from the "All Barcodes" list — pass null to clear back to inherit.
export const updateBarcodeRate = (barcodeId: number, payload: { pcsAmount?: number | null; managerPcsAmount?: number | null }) =>
  client.put<{ success: boolean }>(`/admin/sales-target/barcode-rate/${barcodeId}`, payload);

export const deleteBarcodeRate = (barcodeId: number) => client.delete<{ success: boolean }>(`/admin/sales-target/barcode-rate/${barcodeId}`);
