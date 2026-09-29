import client from './client';

export type ShayariScheduleDay = { scheduleId: number; date: string; text: string; author: string; isEdited: boolean; isToday: boolean };
export type ShayariBankItem = { shayariId: number; text: string; author: string; createdDate: string };

export const getTodayShayari = () => client.get<{ success: boolean; text: string; author: string; date: string }>('/admin/admin-shayari/today');

export const getShayariSchedule = () => client.get<{ success: boolean; schedule: ShayariScheduleDay[] }>('/admin/admin-shayari/schedule');

export const updateScheduledShayari = (date: string, text: string, author: string) =>
  client.put<{ success: boolean; message: string }>(`/admin/admin-shayari/schedule/${date}`, { text, author });

export const getShayariBank = () => client.get<{ success: boolean; shayari: ShayariBankItem[] }>('/admin/admin-shayari');

export const createShayari = (text: string, author: string) =>
  client.post<{ success: boolean; shayariId: number }>('/admin/admin-shayari', { text, author });

export const updateShayari = (id: number, text: string, author: string) =>
  client.put<{ success: boolean }>(`/admin/admin-shayari/${id}`, { text, author });

export const deleteShayari = (id: number) => client.delete<{ success: boolean }>(`/admin/admin-shayari/${id}`);
