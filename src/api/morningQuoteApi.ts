import client from './client';

export const getTodayQuote = () => client.get<{ success: boolean; text: string; date: string }>('/morning-quote/today');
