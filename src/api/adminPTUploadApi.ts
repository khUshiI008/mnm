import client from './client';

export type PTBrandOption = { id: number; name: string };

export type PTInvoiceOption = {
  orderUploadId: number;
  orderNo: string;
  invoiceNo: string;
  orderDate: string;
  totalItems: number;
};

export type PTUploadRow = {
  id: number;
  ptNo: string;
  orderUploadId: number;
  orderNo: string;
  brandId: number;
  brandName: string;
  invoiceNo: string | null;
  fileName: string | null;
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  excessCount: number;
  unwantedCount: number;
  hasDiscrepancy: boolean;
  status: 'Uploading' | 'Completed' | 'Failed';
};

export type PTPreviewRow = {
  rowNo: number;
  articleNo: string;
  description: string;
  color: string;
  size: string;
  brand: string;
  quantity: number;
  orderedQuantity: number | null;
  purPrice: number;
  issueType: 'Excess' | 'Unwanted' | null;
  isError: boolean;
  message: string | null;
};

export type PTUploadSummary = {
  orderNo: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  excessCount: number;
  unwantedCount: number;
  totalQuantity: number;
  totalAmount: number;
  preview: PTPreviewRow[];
};

export type PTUploadResult = {
  ptUploadId: number;
  ptNo: string;
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  excessCount: number;
  unwantedCount: number;
  hasDiscrepancy: boolean;
};

export type PTItemRow = {
  id: number;
  rowNo: number;
  articleNo: string;
  description: string;
  color: string;
  size: string;
  quantity: number;
  orderedQuantity: number | null;
  purPrice: number | null;
  itemMrp: number | null;
  itemWsp: number | null;
  amount: number;
  invoiceNo: string | null;
  issueType: 'Excess' | 'Unwanted' | null;
  issueNote: string | null;
};

export type PTHeaderTotals = {
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  excessCount: number;
  unwantedCount: number;
  hasDiscrepancy: boolean;
};

export type PickedFile = { uri: string; name: string; type: string };

export const lookupPTBrands = () => client.get<{ success: boolean; brands: PTBrandOption[] }>('/admin/pt-uploads/lookup-options');

export const lookupPTInvoices = (brandId: number) =>
  client.get<{ success: boolean; invoices: PTInvoiceOption[] }>('/admin/pt-uploads/invoices', { params: { brandId } });

export const listPTUploads = (params: { search?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; totalCount: number; page: number; pageSize: number; uploads: PTUploadRow[] }>('/admin/pt-uploads', { params });

function buildUploadFormData(file: PickedFile, extra: Record<string, string>) {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' } as any);
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return form;
}

export const previewPTUpload = (file: PickedFile, brandId: number, orderUploadId: number) =>
  client.post<{ success: boolean; message?: string } & PTUploadSummary>(
    '/admin/pt-uploads/upload/preview',
    buildUploadFormData(file, { brandId: String(brandId), orderUploadId: String(orderUploadId) }),
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  );

export const commitPTUpload = (file: PickedFile, brandId: number, orderUploadId: number, invoiceNo: string) =>
  client.post<{ success: boolean; message?: string } & PTUploadResult>(
    '/admin/pt-uploads/upload/commit',
    buildUploadFormData(file, { brandId: String(brandId), orderUploadId: String(orderUploadId), invoiceNo }),
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  );

export const deletePTUpload = (id: number) => client.delete<{ success: boolean; message?: string }>(`/admin/pt-uploads/${id}`);

export const listPTItems = (ptUploadId: number, params: { page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; totalCount: number; page: number; pageSize: number; items: PTItemRow[] }>(
    `/admin/pt-uploads/${ptUploadId}/items`,
    { params }
  );

export const updatePTItem = (itemId: number, fields: { quantity: number; purPrice?: number; itemMrp?: number; itemWsp?: number; description?: string }) =>
  client.put<{ success: boolean; message?: string; amount: number; issueType: string | null; issueNote: string | null; headerTotals: PTHeaderTotals }>(
    `/admin/pt-uploads/items/${itemId}`,
    fields
  );

export const deletePTItem = (itemId: number) =>
  client.delete<{ success: boolean; message?: string; headerTotals: PTHeaderTotals }>(`/admin/pt-uploads/items/${itemId}`);
