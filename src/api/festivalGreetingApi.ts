import client from './client';

export type FestivalGreetingCheck =
  | { success: boolean; active: false }
  | {
      success: boolean;
      active: true;
      festivalGreetingId: number;
      title: string;
      imageUrl: string;
      audioUrl: string;
      /** Optional — when set, the modal plays this full-screen instead of the image+audio-clip layout. See FestivalGreetingModal.tsx's videoUrl branch. */
      videoUrl: string | null;
      message: string;
      messageAuthor: string | null;
    };

export const getActiveFestivalGreeting = () => client.get<FestivalGreetingCheck>('/festival-greeting/active');
