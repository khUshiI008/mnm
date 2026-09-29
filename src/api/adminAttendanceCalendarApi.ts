import client from './client';

export type CalendarDay = {
  day: number;
  dow: number;
  dateDisplay: string;
  status: 'present' | 'late' | 'halfday' | 'absent' | 'leave' | 'upcoming' | 'notyet' | 'nodata';
  statusLabel: string;
  checkIn: string | null;
  checkOut: string | null;
  workHours: string | null;
  leaveType: string | null;
  hasExcessBreak: boolean;
  isToday: boolean;
};

export type AttendanceCalendar = {
  success: boolean;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  bioCode: string;
  deptName: string;
  year: number;
  month: number;
  monthLabel: string;
  firstDow: number;
  daysInMonth: number;
  prevYear: number;
  prevMonth: number;
  nextYear: number;
  nextMonth: number;
  isCurrentMonth: boolean;
  presentCount: number;
  lateCount: number;
  halfDayCount: number;
  absentCount: number;
  leaveCount: number;
  days: CalendarDay[];
};

export const getAttendanceCalendar = (empId: number, year: number, month: number) =>
  client.get<AttendanceCalendar>('/admin/attendance-calendar', { params: { empId, year, month } });

export type PunchDetailPunch = { seq: number; time: string; type: 'in' | 'out'; typeLabel: string };

export type PunchDetailSegment = {
  fromSeq: number;
  fromTime: string;
  fromType: 'out';
  fromTypeLabel: string;
  toSeq: number;
  toTime: string;
  toType: 'in';
  toTypeLabel: string;
  segLabel: string;
  segDuration: string;
};

export type PunchDetails = {
  success: boolean;
  found: boolean;
  employeeName: string;
  employeeCode: string;
  deptName: string;
  bioCode: string;
  dateDisplay: string;
  swipeCount: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  middleCount: number;
  punches: PunchDetailPunch[];
  segments: PunchDetailSegment[];
};

export const getPunchDetails = (bioCode: string, dateYmd: string) =>
  client.get<PunchDetails>('/admin/attendance-calendar/punch-details', { params: { code: bioCode, date: dateYmd } });
