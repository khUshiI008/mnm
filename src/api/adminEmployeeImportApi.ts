import client from './client';

export type EmployeeImportPreviewRow = {
  rowNumber: number;
  code: string;
  employeeName: string;
  department: string;
  designation: string;
  action: 'Insert' | 'Update';
  isValid: boolean;
  errorMessage: string;
};

export type EmployeeImportSummary = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  insertRows: number;
  updateRows: number;
  rows: EmployeeImportPreviewRow[];
};

export type EmployeeImportCommitResult = { created: number; updated: number; skipped: number };

export type PickedFile = { uri: string; name: string; type: string };

function buildFormData(file: PickedFile) {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as any);
  return form;
}

export const previewEmployeeImport = (file: PickedFile) =>
  client.post<{ success: boolean; summary: EmployeeImportSummary; message?: string }>('/admin/employees/import/preview', buildFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

export const commitEmployeeImport = (file: PickedFile) =>
  client.post<{ success: boolean; result: EmployeeImportCommitResult; message: string }>('/admin/employees/import/commit', buildFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
