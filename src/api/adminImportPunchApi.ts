import client from './client';

export type ImportPreviewRow = {
  employeeLabel: string;
  dateDisplay: string;
  punchesDisplay: string;
  checkInDisplay: string;
  checkOutDisplay: string;
};

export type ImportDryRunSummary = {
  fileName: string;
  totalDateColumns: number;
  matchedEmployees: number;
  totalPunches: number;
  daysWithPunches: number;
  absentDays: number;
  unmatchedCount: number;
  unmatchedCodes: string[];
  dateFromDisplay: string;
  dateToDisplay: string;
  preview: ImportPreviewRow[];
};

export type ImportCommitResult = {
  totalPunches: number;
  totalEmployees: number;
  totalDays: number;
  attCreated: number;
  attUpdated: number;
  unmatchedCodes: number;
  absentDaysCount: number;
};

export type PickedFile = { uri: string; name: string; type: string };

function buildFormData(file: PickedFile) {
  const form = new FormData();
  // React Native's FormData accepts { uri, name, type } as the file value.
  form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as any);
  return form;
}

export const previewImportPunch = (file: PickedFile) =>
  client.post<{ success: boolean; summary: ImportDryRunSummary; message?: string }>('/admin/import-punch/preview', buildFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

export const commitImportPunch = (file: PickedFile) =>
  client.post<{ success: boolean; result: ImportCommitResult; message: string }>('/admin/import-punch/commit', buildFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

export const reprocessAllAttendance = () =>
  client.post<{ success: boolean; result: { created: number; updated: number; totalDays: number }; message: string }>('/admin/import-punch/reprocess', undefined, {
    timeout: 120000,
  });
