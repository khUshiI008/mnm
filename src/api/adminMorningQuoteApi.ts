import client from './client';

export type ScheduleDay = { scheduleId: number; date: string; text: string; isEdited: boolean; isToday: boolean };
export type QuoteBankItem = { quoteId: number; text: string; createdDate: string };

export const getSchedule = () => client.get<{ success: boolean; schedule: ScheduleDay[] }>('/admin/morning-quotes/schedule');

export const updateScheduledQuote = (date: string, text: string) =>
  client.put<{ success: boolean; message: string }>(`/admin/morning-quotes/schedule/${date}`, { text });

export const getQuoteBank = () => client.get<{ success: boolean; quotes: QuoteBankItem[] }>('/admin/morning-quotes');

export const createQuote = (text: string) => client.post<{ success: boolean; quoteId: number }>('/admin/morning-quotes', { text });

export const updateQuote = (id: number, text: string) => client.put<{ success: boolean }>(`/admin/morning-quotes/${id}`, { text });

export const deleteQuote = (id: number) => client.delete<{ success: boolean }>(`/admin/morning-quotes/${id}`);
