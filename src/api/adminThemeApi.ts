import client from './client';

export type ThemeValues = {
  primary: string;
  primary_dark: string;
  accent: string;
  sidebar_bg: string;
  sidebar_bg_light: string;
  sidebar_width: string;
  page_bg: string;
  surface_bg: string;
  text_color: string;
  border_color: string;
  font_family: string;
  font_size: string;
  card_radius: string;
  btn_radius: string;
  logo_text: string;
  logo_initials: string;
  table_density: string;
};

export type ThemePreset = {
  name: string;
  tag: string;
  contrast: string;
  description: string;
  primary: string;
  primaryDark: string;
  accent: string;
  sidebarBg: string;
  sidebarBgLight: string;
  pageBg: string;
  surfaceBg: string;
  textColor: string;
  borderColor: string;
};

export const getTheme = () => client.get<{ success: boolean; theme: ThemeValues; presets: ThemePreset[]; defaults: ThemeValues }>('/admin/theme');

export const saveTheme = (values: Partial<ThemeValues>) => client.post<{ success: boolean; theme: ThemeValues; message: string }>('/admin/theme', values);

export const resetTheme = () => client.post<{ success: boolean; theme: ThemeValues; message: string }>('/admin/theme/reset');
