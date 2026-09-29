import client from './client';

export type OrderBrandOption = { id: number; name: string };

export type OrderRow = {
  id: number;
  orderNo: string;
  orderDate: string;
  brandId: number;
  brandName: string;
  fileName: string | null;
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  invoiceNo: string | null;
  invoiceDt: string | null;
  status: 'Uploading' | 'Completed' | 'Failed';
  hasPTDiscrepancy: boolean;
};

export type OrderPreviewRow = {
  rowNo: number;
  articleNo: string;
  description: string;
  color: string;
  size: string;
  brand: string;
  quantity: number;
  purPrice: number;
  isError: boolean;
  message: string | null;
};

export type OrderUploadSummary = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  totalQuantity: number;
  totalAmount: number;
  preview: OrderPreviewRow[];
};

export type OrderUploadResult = {
  orderUploadId: number;
  orderNo: string;
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
};

export type OrderItemRow = {
  id: number;
  rowNo: number;
  articleNo: string;
  description: string;
  color: string;
  size: string;
  quantity: number;
  purPrice: number | null;
  itemMrp: number | null;
  itemWsp: number | null;
  amount: number;
  invoiceNo: string | null;
};

export type OrderHeaderTotals = { totalItems: number; totalQuantity: number; totalAmount: number };

export type PickedFile = { uri: string; name: string; type: string };

export const lookupOrderBrands = () => client.get<{ success: boolean; brands: OrderBrandOption[] }>('/admin/orders/lookup-options');

export const listOrders = (params: { search?: string; page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; totalCount: number; page: number; pageSize: number; orders: OrderRow[] }>('/admin/orders', { params });

function buildUploadFormData(file: PickedFile, extra: Record<string, string>) {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type || 'application/octet-stream' } as any);
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return form;
}

export const previewOrderUpload = (file: PickedFile, brandId: number) =>
  client.post<{ success: boolean; message?: string } & OrderUploadSummary>(
    '/admin/orders/upload/preview',
    buildUploadFormData(file, { brandId: String(brandId) }),
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  );

export const commitOrderUpload = (file: PickedFile, orderDate: string, brandId: number) =>
  client.post<{ success: boolean; message?: string } & OrderUploadResult>(
    '/admin/orders/upload/commit',
    buildUploadFormData(file, { orderDate, brandId: String(brandId) }),
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  );

export const updateOrderHeader = (id: number, orderDate: string, brandId: number) =>
  client.put<{ success: boolean; message?: string }>(`/admin/orders/${id}`, { orderDate, brandId });

export const deleteOrder = (id: number) => client.delete<{ success: boolean; message?: string }>(`/admin/orders/${id}`);

export const listOrderItems = (orderUploadId: number, params: { page?: number; pageSize?: number }) =>
  client.get<{ success: boolean; totalCount: number; page: number; pageSize: number; items: OrderItemRow[] }>(
    `/admin/orders/${orderUploadId}/items`,
    { params }
  );

export const updateOrderItem = (
  itemId: number,
  fields: { quantity: number; purPrice?: number; itemMrp?: number; itemWsp?: number; description?: string; color?: string; size?: string }
) =>
  client.put<{ success: boolean; message?: string; amount: number; headerTotals: OrderHeaderTotals }>(
    `/admin/orders/items/${itemId}`,
    fields
  );

export const deleteOrderItem = (itemId: number) =>
  client.delete<{ success: boolean; message?: string; headerTotals: OrderHeaderTotals }>(`/admin/orders/items/${itemId}`);
