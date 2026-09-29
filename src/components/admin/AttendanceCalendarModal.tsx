import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import Icon from '../Icon';
import { colors, radius, spacing } from '../../theme';
import { AttendanceCalendar, CalendarDay, getAttendanceCalendar, getPunchDetails, PunchDetails } from '../../api/adminAttendanceCalendarApi';

const A = colors.admin;
const DOW_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Colors mirror Panel/Dashboard.aspx's .dash-cal-day.st-* rules exactly, so the
// mobile calendar reads identically to the admin web panel's reference calendar.
function statusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'present':
    case 'late':
      return { bg: '#16a34a', text: '#fff' };
    case 'halfday':
      return { bg: '#fce588', text: '#6b4e00' };
    case 'absent':
      return { bg: '#dc2626', text: '#fff' };
    case 'leave':
      return { bg: '#9b7fd4', text: '#fff' };
    case 'notyet':
      return { bg: A.surface, text: '#64748b' };
    case 'upcoming':
    case 'nodata':
    default:
      return { bg: A.surfaceRaised, text: A.muted };
  }
}

function LateFlag() {
  return (
    <View style={styles.lateFlagWrap} pointerEvents="none">
      <Svg width={15} height={15} viewBox="0 0 15 15">
        <Polygon points="0,0 15,0 0,15" fill="#fbbf24" />
      </Svg>
    </View>
  );
}

/** Top-right corner mark — a present/late day that ALSO had excess break. */
function ExcessBreakFlag() {
  return (
    <View style={styles.excessFlagWrap} pointerEvents="none">
      <Svg width={15} height={15} viewBox="0 0 15 15">
        <Polygon points="0,0 15,0 15,15" fill="#dc2626" />
      </Svg>
    </View>
  );
}

type Props = {
  visible: boolean;
  employeeId: number;
  onClose: () => void;
  /** e.g. "Late Days" — the metric that put this employee on the list being drilled into. */
  contextLabel?: string;
  /** e.g. "16" — shown next to contextLabel as a highlighted chip under the employee name. */
  contextValue?: string;
};

export default function AttendanceCalendarModal({ visible, employeeId, onClose, contextLabel, contextValue }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<AttendanceCalendar | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [punchDetails, setPunchDetails] = useState<PunchDetails | null>(null);
  const [punchLoading, setPunchLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(null);
    setPunchDetails(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, employeeId]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getAttendanceCalendar(employeeId, year, month)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, employeeId, year, month]);

  const changeMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDay(null);
    setPunchDetails(null);
  };

  const onDayPress = (d: CalendarDay) => {
    if (selectedDay === d.day) {
      setSelectedDay(null);
      setPunchDetails(null);
      return;
    }
    setSelectedDay(d.day);
    setPunchDetails(null);
    if (data?.bioCode) {
      const dateYmd = `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
      setPunchLoading(true);
      getPunchDetails(data.bioCode, dateYmd)
        .then((res) => setPunchDetails(res.data))
        .finally(() => setPunchLoading(false));
    }
  };

  const selected = data?.days.find((d) => d.day === selectedDay) || null;

  // Default to this month's late-day count when the caller doesn't pass its own
  // metric (e.g. Performance Report passes the leaderboard category tapped) — this
  // is what surfaces "why is this employee on the Late Coming list" right here.
  const badgeLabel = contextLabel ?? 'Late Days';
  const badgeValue = contextValue ?? (data ? String(data.lateCount) : undefined);

  const weeks: (CalendarDay | null)[][] = [];
  if (data) {
    const cells: (CalendarDay | null)[] = [...Array.from({ length: data.firstDow }, () => null), ...data.days];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.breadcrumb}>
              Attendance <Icon name="chevronRight" size={12} color={A.muted} /> Calendar
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color={A.muted} />
            </Pressable>
          </View>

          {data && (
            <View style={styles.empRow}>
              <View style={styles.empIcon}>
                <Icon name="calendar" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>
                  {data.employeeName} ({data.employeeCode})
                </Text>
                <View style={styles.deptBadge}>
                  <Text style={styles.deptBadgeText}>{data.deptName}</Text>
                </View>
              </View>
              {!!badgeValue && (
                <View style={styles.contextBadge}>
                  <Text style={styles.contextBadgeValue}>{badgeValue}</Text>
                  <Text style={styles.contextBadgeLabel}>{badgeLabel}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.monthNav}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.navBtn}>
              <Icon name="chevronLeft" size={16} color={A.ink} />
            </Pressable>
            <Text style={styles.monthLabel}>{data?.monthLabel || ''}</Text>
            <Pressable onPress={() => changeMonth(1)} style={styles.navBtn}>
              <Icon name="chevronRight" size={16} color={A.ink} />
            </Pressable>
          </View>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={A.primary} />
            </View>
          )}

          {!loading && data && (
            <ScrollView>
              <View style={styles.dowRow}>
                {DOW_LABELS.map((l) => (
                  <Text key={l} style={styles.dowLabel}>
                    {l}
                  </Text>
                ))}
              </View>
              {weeks.map((week, wi) => (
                <View key={`w-${wi}`} style={styles.calRow}>
                  {week.map((d, di) =>
                    d ? (
                      <View
                        key={d.day}
                        style={d.isToday ? styles.todayRingOuter : styles.calCell}
                      >
                        {d.isToday ? (
                          <View style={styles.todayRingInner}>
                            <DayChip d={d} isSelected={selectedDay === d.day} onPress={() => onDayPress(d)} />
                          </View>
                        ) : (
                          <DayChip d={d} isSelected={selectedDay === d.day} onPress={() => onDayPress(d)} />
                        )}
                      </View>
                    ) : (
                      <View key={`pad-${wi}-${di}`} style={styles.calCell} />
                    )
                  )}
                </View>
              ))}

              <View style={styles.countRow}>
                <CountChip label="Present" value={data.presentCount} tone="#16a34a" />
                <CountChip label="Late" value={data.lateCount} tone="#d97706" />
                <CountChip label="Half Day" value={data.halfDayCount} tone="#6b4e00" />
                <CountChip label="Absent" value={data.absentCount} tone="#dc2626" />
                <CountChip label="Leave" value={data.leaveCount} tone="#9b7fd4" />
              </View>
            </ScrollView>
          )}

          <Text style={styles.footerHint}>Tap a day for check-in / check-out times</Text>
        </Pressable>
      </Pressable>

      {selected && (
        <Modal visible transparent animationType="fade" onRequestClose={() => onDayPress(selected)}>
          <Pressable style={styles.backdrop} onPress={() => onDayPress(selected)}>
            <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.detailHeadRow}>
                <Text style={styles.detailDate}>{selected.dateDisplay}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusColors(selected.status).bg + '1a' }]}>
                  <Text style={[styles.statusPillText, { color: statusColors(selected.status).bg }]}>{selected.statusLabel}</Text>
                </View>
              </View>
              {(selected.checkIn || selected.checkOut) && (
                <Text style={styles.detailMeta}>
                  In {selected.checkIn || '—'} · Out {selected.checkOut || '—'}
                  {selected.workHours ? ` · ${selected.workHours}` : ''}
                </Text>
              )}

              {punchLoading && (
                <View style={styles.punchLoadingBox}>
                  <ActivityIndicator size="small" color={A.primary} />
                </View>
              )}

              {!punchLoading && punchDetails && punchDetails.punches.length > 0 && (
                <ScrollView>
                  <Text style={styles.punchesTitle}>All Punches</Text>
                  <View style={styles.punchesBox}>
                    {punchDetails.punches.map((p) => (
                      <View key={p.seq} style={styles.punchRow}>
                        <Text style={styles.punchSeq}>#{p.seq}</Text>
                        <Text style={styles.punchTime}>{p.time}</Text>
                        <View style={[styles.punchBadge, p.type === 'in' ? styles.punchBadgeIn : styles.punchBadgeOut]}>
                          <Text style={[styles.punchBadgeText, { color: p.type === 'in' ? '#16a34a' : '#dc2626' }]}>{p.typeLabel}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}

              {!punchLoading && punchDetails && punchDetails.punches.length === 0 && (
                <Text style={styles.punchesEmpty}>No punch data for this day.</Text>
              )}

              <Pressable style={styles.detailCloseBtn} onPress={() => onDayPress(selected)}>
                <Text style={styles.detailCloseBtnText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Modal>
  );
}

function CountChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={styles.countChip}>
      <Text style={[styles.countValue, { color: tone }]}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function DayChip({ d, isSelected, onPress }: { d: CalendarDay; isSelected: boolean; onPress: () => void }) {
  const c = statusColors(d.status);
  return (
    <Pressable
      style={[styles.dayCell, d.status === 'notyet' ? styles.dayCellNotYet : { backgroundColor: c.bg }]}
      onPress={onPress}
    >
      {d.status === 'late' && <LateFlag />}
      {d.hasExcessBreak && <ExcessBreakFlag />}
      <Text style={[styles.dayText, { color: c.text }]}>{d.day}</Text>
      {/* Overlay ring, not a border on the cell itself — changing this cell's own
          borderWidth on tap (the old approach) altered its box model and could clip/
          repaint its absolutely-positioned LateFlag + centered Text on Android,
          which is what looked like the number and late-corner "vanishing" on tap.
          Mirrors the separate todayRingOuter/Inner wrapper already used elsewhere
          in this file for the same reason. */}
      {isSelected && <View style={styles.dayCellSelectedRing} pointerEvents="none" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.6)', justifyContent: 'center', padding: spacing(2) },
  sheet: { backgroundColor: A.surface, borderRadius: radius.lg, padding: 16, maxHeight: '85%' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  breadcrumb: { fontSize: 12, color: A.muted, fontWeight: '600' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surfaceRaised },

  empRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  empIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  empName: { fontSize: 14, fontWeight: '800', color: A.ink },
  deptBadge: { alignSelf: 'flex-start', backgroundColor: A.surfaceRaised, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  deptBadgeText: { fontSize: 10, fontWeight: '700', color: A.primary },
  contextBadge: { alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  contextBadgeValue: { fontSize: 16, fontWeight: '800', color: '#92400e' },
  contextBadgeLabel: { fontSize: 9, fontWeight: '700', color: '#92400e', textTransform: 'uppercase' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surfaceRaised },
  monthLabel: { fontSize: 13, fontWeight: '800', color: A.ink },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },

  dowRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: '800', color: A.muted, textTransform: 'uppercase' },

  calRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  calCell: { flex: 1, aspectRatio: 1 },
  todayRingOuter: { flex: 1, aspectRatio: 1, borderRadius: 14, borderWidth: 2, borderColor: A.primary, padding: 2 },
  todayRingInner: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: A.surface },

  dayCell: { flex: 1, margin: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  dayCellNotYet: { backgroundColor: A.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: '#94a3b8' },
  dayCellSelectedRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 2, borderColor: A.ink, zIndex: 2 },
  dayText: { fontSize: 13, fontWeight: '800' },
  lateFlagWrap: { position: 'absolute', top: 0, left: 0, zIndex: 1 },
  excessFlagWrap: { position: 'absolute', top: 0, right: 0, zIndex: 1 },

  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
  countChip: { alignItems: 'center', minWidth: 50 },
  countValue: { fontSize: 14, fontWeight: '800' },
  countLabel: { fontSize: 9, color: A.muted, marginTop: 1 },

  detailCard: { backgroundColor: A.surfaceRaised, borderRadius: radius.lg, padding: 16, width: '100%', maxWidth: 360, maxHeight: '80%' },
  detailHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailDate: { fontSize: 13, fontWeight: '700', color: A.ink },
  detailMeta: { fontSize: 11, color: A.muted, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  detailCloseBtn: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999, backgroundColor: A.surface },
  detailCloseBtnText: { fontSize: 12, fontWeight: '700', color: A.ink },

  punchLoadingBox: { paddingVertical: 12, alignItems: 'center' },
  punchesTitle: { fontSize: 10, fontWeight: '800', color: A.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 6 },
  punchesBox: { borderWidth: 1, borderColor: A.border, borderRadius: 8, overflow: 'hidden' },
  punchesEmpty: { fontSize: 11, color: A.muted, marginTop: 10, textAlign: 'center' },
  punchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: A.border },
  punchSeq: { fontSize: 10, fontWeight: '700', color: A.muted, width: 24 },
  punchTime: { fontSize: 12, fontWeight: '700', color: A.ink, flex: 1 },
  punchBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  punchBadgeIn: { backgroundColor: 'rgba(22,163,74,.1)' },
  punchBadgeOut: { backgroundColor: 'rgba(220,38,38,.1)' },
  punchBadgeText: { fontSize: 10, fontWeight: '800' },

  footerHint: { fontSize: 10, color: A.muted, textAlign: 'center', marginTop: 10 },
});
