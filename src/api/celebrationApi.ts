import client from './client';

/** Fetches (rendering it server-side the first time) a personalized Birthday/Anniversary wish video URL — see celebrationVideoService.js. */
export const getCelebrationVideoUrl = (type: 'Birthday' | 'Anniversary', name: string) =>
  client.get<{ success: boolean; url: string }>('/admin/celebration-video', { params: { type, name } });
