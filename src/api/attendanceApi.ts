import client from './client';

export type AttendanceDay = {
  date: string;
  dayName: string;
  checkIn: string | null;
  checkOut: string | null;
  duration: string | null;
  statusCss: string;
  statusLabel: string;
  isEarlyGoing: boolean;
  hasExcessBreak?: boolean;
  excessBreakMins?: number;
};

export type AttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  partial: number;
  working: number;
  attendancePct: number;
};

export type MonthlyAttendanceResponse = {
  success: boolean;
  source: string;
  message?: string;
  summary: AttendanceSummary;
  days: AttendanceDay[];
};

export const getMonthlyAttendance = (year: number, month: number) =>
  client.get<MonthlyAttendanceResponse>('/attendance/monthly', { params: { year, month } });

export const getTodayStatus = () =>
  client.get<{ success: boolean; swipeCount: number; lastSwipeAt: string | null; needsCheckInSelfie: boolean }>(
    '/attendance/today'
  );

export const uploadCheckInSelfie = (image: string, lat?: number, lng?: number) =>
  client.post('/attendance/selfie/check-in', { image, lat, lng });

export const uploadBreakSelfie = (image: string, lat?: number, lng?: number) =>
  client.post('/attendance/selfie/break', { image, lat, lng });

export type TodaySelfie = { url: string; capturedAt: string | null; hasLocation: boolean; latitude: number | null; longitude: number | null };
export type TodayBreakSelfie = TodaySelfie & { breakNumber: number; isExcess: boolean };

export const getTodaySelfies = () =>
  client.get<{ success: boolean; checkIn: TodaySelfie | null; breaks: TodayBreakSelfie[] }>('/attendance/selfies/today');

// ---- "My Status Overview" KPI cards — mirrors Employee/Dashboard.aspx's hfKpiToday/Week/Month ----

export type KpiSwipe = { time: string; isIn: boolean };
export type KpiBreakInterval = {
  breakNum: number;
  startTime: string;
  endTime: string | null;
  durationMins: number;
  cumulativeMins: number;
  isExcess: boolean;
  excessAmt: number;
  exceedAt: string | null;
  isOpen: boolean;
};
export type TodayKpi = {
  arrivedToday: boolean;
  arrivedTime: string | null;
  currentlyIn: boolean;
  onBreak: boolean;
  punchCount: number;
  swipes: KpiSwipe[];
  shiftStart: string | null;
  shiftEnd: string | null;
  allocatedBreakMins: number;
  actualBreakMins: number;
  isExcessBreak: boolean;
  excessBreakMins: number;
  breakSince: string | null;
  isOnLeave: boolean;
  leaveType: string | null;
  isLate: boolean;
  lateMinutes: number;
  isHighPuncher: boolean;
  isEarlyGoing: boolean;
  earlyGoingMins: number;
  prevDayLastPunch: string | null;
  isHalfDay: boolean;
  halfDayWorkedStr: string | null;
  breakIntervals: KpiBreakInterval[];
};
export type KpiCalDay = {
  day: number;
  dateDisplay: string;
  status: 'upcoming' | 'leave' | 'weekend' | 'absent' | 'ok' | 'excess';
  /** Independent of `status` — a present/excess day can also be late, same as the admin calendar's separate LateFlag + ExcessBreakFlag corners. */
  isLate: boolean;
  isWeekend: boolean;
  brkMins: number;
  exMins: number;
  isToday: boolean;
  checkIn: string | null;
  checkOut: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  swipes: KpiSwipe[] | null;
  breakIntervals: KpiBreakInterval[] | null;
};
export type RangeKpi = {
  [key: string]: any;
  allocatedBreakMins: number;
  swipeDays: { date: string; swipes: KpiSwipe[] }[];
  calDays: KpiCalDay[];
  firstDow: number;
  monthLabel: string;
  calYear: number;
  calMonth: number;
};

export const getKpi = () => client.get<{ success: boolean; today: TodayKpi | null; week: RangeKpi | null; month: RangeKpi | null }>('/attendance/kpi');

export const getKpiCalendar = (year: number, month: number) =>
  client.get<{ success: boolean; year: number; month: number; monthLabel: string; firstDow: number; isCurrentMonth: boolean; calDays: KpiCalDay[] }>(
    '/attendance/kpi/calendar',
    { params: { year, month } }
  );

export const recordPunch = () =>
  client.post<{ success: boolean; isCurrentlyIn: boolean; lastPunchTime: string | null; source: string }>('/attendance/punch');
