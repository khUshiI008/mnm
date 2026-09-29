import React from 'react';
import Svg, { Path, Rect, Circle, Polyline, Polygon, Line } from 'react-native-svg';

/**
 * Feather-style stroke icons (24x24 viewBox, stroke-width 2), matching the
 * inline SVGs used across WebApplication1 (Login.aspx, Employee/Dashboard.Master).
 */
const icons: Record<string, React.FC<{ color: string; strokeWidth: number }>> = {
  phone: ({ color, strokeWidth }) => (
    <Path
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  lock: ({ color, strokeWidth }) => (
    <>
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  grid: ({ color, strokeWidth }) => (
    <>
      <Rect x={3} y={3} width={7} height={7} rx={1} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x={14} y={3} width={7} height={7} rx={1} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x={3} y={14} width={7} height={7} rx={1} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Rect x={14} y={14} width={7} height={7} rx={1} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </>
  ),
  document: ({ color, strokeWidth }) => (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  dollar: ({ color, strokeWidth }) => (
    <>
      <Line x1={12} y1={1} x2={12} y2={23} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  bank: ({ color, strokeWidth }) => (
    <>
      <Line x1={3} y1={21} x2={21} y2={21} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={5} y1={21} x2={5} y2={10} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={19} y1={21} x2={19} y2={10} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Polyline points="2 10 12 3 22 10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={9} y1={21} x2={9} y2={10} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={15} y1={21} x2={15} y2={10} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  trendingUp: ({ color, strokeWidth }) => (
    <>
      <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points="17 6 23 6 23 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  user: ({ color, strokeWidth }) => (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </>
  ),
  // KPI card icons — copied from the ICO object in Employee/Dashboard.aspx's inline KPI renderer.
  logIn: ({ color, strokeWidth }) => (
    <>
      <Path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points="10 17 15 12 10 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={15} y1={12} x2={3} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  zap: ({ color, strokeWidth }) => (
    <Polygon
      points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  alertCircle: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={12} y1={8} x2={12} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={12} y1={16} x2={12.01} y2={16} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  logOut: ({ color, strokeWidth }) => (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={21} y1={12} x2={9} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  clockAlert: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Polyline points="12 6 12 12 16 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={16} y1={16} x2={16.01} y2={16} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  calendar: ({ color, strokeWidth }) => (
    <>
      <Rect x={3} y={4} width={18} height={18} rx={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={16} y1={2} x2={16} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={8} y1={2} x2={8} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  check: ({ color, strokeWidth }) => (
    <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  x: ({ color, strokeWidth }) => (
    <>
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  chevronLeft: ({ color, strokeWidth }) => (
    <Polyline points="15 18 9 12 15 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  chevronRight: ({ color, strokeWidth }) => (
    <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  chevronDown: ({ color, strokeWidth }) => (
    <Polyline points="6 9 12 15 18 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  // Admin sidebar/topbar/bottomnav icons — copied verbatim from Panel/Dashboard.Master.
  building: ({ color, strokeWidth }) => (
    <>
      <Path d="M3 21h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M5 21V7l8-4v18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M19 21V11l-6-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  twoUsers: ({ color, strokeWidth }) => (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={9} cy={7} r={4} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  calendarCheck: ({ color, strokeWidth }) => (
    <>
      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={16} y1={2} x2={16} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={8} y1={2} x2={8} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={strokeWidth} />
      <Polyline points="8 14 10.5 16.5 16 11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  briefcase: ({ color, strokeWidth }) => (
    <>
      <Rect x={2} y={7} width={20} height={14} rx={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={12} y1={12} x2={12} y2={16} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={10} y1={14} x2={14} y2={14} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  box: ({ color, strokeWidth }) => (
    <>
      <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={3} y1={6} x2={21} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 10a1 1 0 0 0 2 0M13 10a1 1 0 0 0 2 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  cashRegister: ({ color, strokeWidth }) => (
    <>
      <Rect x={2} y={3} width={20} height={14} rx={2} ry={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={8} y1={21} x2={16} y2={21} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={12} y1={17} x2={12} y2={21} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  barTrend: ({ color, strokeWidth }) => (
    <>
      <Path d="M3 3v18h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M18.7 8l-5.1 5.2-4-4L3 16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  gear: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  hamburger: ({ color, strokeWidth }) => (
    <>
      <Line x1={3} y1={6} x2={21} y2={6} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={3} y1={12} x2={21} y2={12} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={3} y1={18} x2={21} y2={18} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  search: ({ color, strokeWidth }) => (
    <>
      <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  bell: ({ color, strokeWidth }) => (
    <>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  home: ({ color, strokeWidth }) => (
    <>
      <Path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M9 21V13h6v8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  personCheck: ({ color, strokeWidth }) => (
    <>
      <Circle cx={9} cy={7} r={4} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M3 21v-1a7 7 0 0 1 7-7h.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M17 17l2 2 4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  creditCardDot: ({ color, strokeWidth }) => (
    <>
      <Rect x={2} y={6} width={20} height={13} rx={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M2 11h20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={16} r={1.5} fill={color} stroke="none" />
    </>
  ),
  loanBag: ({ color, strokeWidth }) => (
    <>
      <Rect x={2} y={7} width={20} height={14} rx={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M12 12v5M9.5 14.5h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  camera: ({ color, strokeWidth }) => (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </>
  ),
  image: ({ color, strokeWidth }) => (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={8.5} cy={8.5} r={1.5} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Polyline points="21 15 16 10 5 21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  share: ({ color, strokeWidth }) => (
    <>
      <Circle cx={18} cy={5} r={3} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={6} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={18} cy={19} r={3} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  download: ({ color, strokeWidth }) => (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points="7 10 12 15 17 10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={12} y1={15} x2={12} y2={3} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  ),
  mail: ({ color, strokeWidth }) => (
    <>
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points="22 6 12 13 2 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  mapPin: ({ color, strokeWidth }) => (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={strokeWidth} fill="none" />
    </>
  ),
};

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export default function Icon({ name, size = 20, color = '#1a2236', strokeWidth = 2 }: Props) {
  const Glyph = icons[name];
  if (!Glyph) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Glyph color={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}
