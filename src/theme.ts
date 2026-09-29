export const colors = {
  primary: '#5B3EF5',
  primaryDark: '#4229C7',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  text: '#1B1C2A',
  textMuted: '#6B6E85',
  border: '#E4E5EF',
  success: '#1E9E5A',
  warning: '#C77A00',
  danger: '#D23F3F',
  present: '#1E9E5A',
  late: '#C77A00',
  absent: '#D23F3F',
  partial: '#8B5CF6',
  weekend: '#9CA0B5',
  excess: '#f97316',

  // Matches WebApplication1/Content/login.css :root tokens (light theme)
  login: {
    primary: '#4f46e5',
    primaryDark: '#4338ca',
    ink: '#1e1b3a',
    muted: '#8a8aa3',
    bg: '#eef2ff',
    surface: '#ffffff',
    border: '#e3e4ef',
    inputBg: '#f9fafc',
    danger: '#e11d48',
    dangerBg: '#fee2e2',
    dangerBorder: '#fca5a5',
    success: '#15803d',
    successBg: '#dcfce7',
    successBorder: '#86efac',
    info: '#1d4ed8',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
  },

  // Matches WebApplication1/Content/dashboard.css :root tokens (light theme, admin panel)
  admin: {
    sidebarBg: '#1e1b3a',
    sidebarBgLight: '#272148',
    bg: '#f4f5fb',
    surface: '#ffffff',
    surfaceRaised: '#f0f1fa',
    ink: '#1e1b3a',
    muted: '#8a8aa3',
    border: '#e7e8f3',
    inputBg: '#f9fafc',
    primary: '#4f46e5',
    primaryDark: '#4338ca',
    accent: '#06b6d4',
  },

  // Matches WebApplication1/Content/employeedashboard.css :root tokens (light theme)
  emp: {
    bg: '#f0f4ff',
    surface: '#ffffff',
    surface2: '#f8faff',
    border: '#dde3f0',
    ink: '#1a2236',
    muted: '#6b7a99',
    primary: '#4361ee',
    primaryDark: '#2d47cc',
    green: '#16a34a',
    yellow: '#d97706',
    red: '#e11d48',
    blue: '#2563eb',
    purple: '#7c3aed',
  },

  // Party portal (B2B distributor/retailer self-service login) — deliberately
  // distinct accent (teal) from admin (indigo) and employee (blue) so the
  // role is visually obvious at a glance.
  party: {
    bg: '#f0fdfa',
    surface: '#ffffff',
    surfaceRaised: '#ecfdf9',
    border: '#d6f1ec',
    ink: '#0f2e2b',
    muted: '#5f7d78',
    primary: '#0d9488',
    primaryDark: '#0f766e',
    green: '#16a34a',
    red: '#e11d48',
  },
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 28,
};

export const shadow = {
  card: {
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  loginCard: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 8,
  },
};

export const spacing = (n: number) => n * 8;
