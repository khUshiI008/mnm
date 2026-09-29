import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { DashboardResponse, DeptSection, getDashboard, getMissedPunches, getOverdueReceivables } from '../../api/adminDashboardApi';
import { getEmailInboxUnreadCount } from '../../api/emailInboxApi';
import { DrillDownRow } from './DrillDownListScreen';
import { triggerFestivalGreetingRecheck } from '../../components/FestivalGreetingModal';

const A = colors.admin;

// Module-level (not component state) so it survives DashboardScreen unmounting when
// AdminShell navigates away and back — avoids a blocking reload every time you return.
let dashboardCache: { key: string; data: DashboardResponse } | null = null;

type KpiDef = {
  key: keyof DashboardResponse['kpis'] | 'missedPunches';
  title: string;
  icon: IconName;
  color: string;
  listKey?: string;
  clickable: boolean;
};

// Matches Panel/Dashboard.aspx's 14 KPI cards — exact order, color family, click-ability.
const KPI_DEFS: KpiDef[] = [
  { key: 'totalEmployees', title: 'Total Employees', icon: 'twoUsers', color: '#4f46e5', clickable: true },
  { key: 'arrivedToday', title: 'Arrived Today', icon: 'logIn', color: '#10b981', listKey: 'arrived', clickable: true },
  { key: 'currentlyWorking', title: 'Currently Working', icon: 'user', color: '#14b8a6', listKey: 'currentlyWorking', clickable: true },
  { key: 'onBreak', title: 'On Break', icon: 'clockAlert', color: '#f97316', listKey: 'onBreak', clickable: true },
  { key: 'missedPunches', title: 'Missed Punches', icon: 'alertCircle', color: '#ef4444', clickable: true },
  { key: 'highPunchers', title: 'High Punchers', icon: 'zap', color: '#8b5cf6', listKey: 'highPunchers', clickable: true },
  { key: 'lateComing', title: 'Late Coming', icon: 'alertCircle', color: '#dc2626', listKey: 'lateComing', clickable: true },
  { key: 'earlyGoing', title: 'Early Going', icon: 'logOut', color: '#0ea5e9', listKey: 'earlyGoing', clickable: true },
  { key: 'excessBreak', title: 'Excess Break', icon: 'clockAlert', color: '#f97316', listKey: 'excessBreak', clickable: true },
  { key: 'notYetCome', title: 'Not Yet Come', icon: 'x', color: '#f43f5e', listKey: 'notYetCome', clickable: true },
  { key: 'onLeave', title: 'On Leave', icon: 'calendar', color: '#06b6d4', listKey: 'onLeave', clickable: true },
  { key: 'noBioConfigured', title: 'No Bio Configured', icon: 'alertCircle', color: '#f59e0b', listKey: 'noBio', clickable: true },
  { key: 'halfDay', title: 'Half Day', icon: 'calendarCheck', color: '#d946ef', listKey: 'halfDay', clickable: true },
  { key: 'overdueReceivable' as any, title: 'Overdue Receivable', icon: 'briefcase', color: '#10b981', clickable: true },
];

function dateKeyToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysToKey(key: string, delta: number) {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDateLong(key: string) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDateShort(key: string) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function rowsFrom(list: any[], subFn: (r: any) => string, badgeFn?: (r: any) => string | undefined): DrillDownRow[] {
  return (list || []).map((r) => ({
    employeeId: r.employeeId,
    name: r.employeeName || r.name || '—',
    sub: subFn(r),
    badge: badgeFn?.(r),
    phone: r.mobileNo || undefined,
    department: r.deptName && r.deptName !== '—' ? r.deptName : undefined,
    designation: r.desigName && r.desigName !== '—' ? r.desigName : undefined,
    leave: r.leave || undefined,
    onApprovedLeave: r.onApprovedLeave || undefined,
  }));
}

const SUB_BUILDERS: Record<string, (r: any) => string> = {
  arrived: (r) => `${r.deptName} · First: ${r.firstInDisplay}`,
  currentlyWorking: (r) => `${r.deptName} · Since ${r.firstInDisplay}`,
  onBreak: (r) => `${r.deptName} · Out ${r.onBreakDuration}`,
  notYetCome: (r) => r.deptName,
  highPunchers: (r) => `${r.deptName} · ${r.swipeCount} punches`,
  lateComing: (r) => `${r.deptName} · ${r.lateByDisplay}`,
  earlyGoing: (r) => `${r.deptName} · ${r.earlyByDisplay}`,
  halfDay: (r) => `${r.deptName} · ${r.workedDisplay}`,
  excessBreak: (r) => `${r.deptName} · ${r.excessDisplay}`,
  onLeave: (r) => `${r.leaveTypeName} · ${r.fromDateDisplay}`,
  noBio: (r) => r.deptName,
};

const BADGE_BUILDERS: Record<string, (r: any) => string | undefined> = {
  lateComing: (r) => (r.lateDaysThisMonth != null ? `${r.lateDaysThisMonth} day${r.lateDaysThisMonth === 1 ? '' : 's'} late` : undefined),
};

export default function DashboardScreen() {
  const { navigate } = useAdminNav();

  useFocusEffect(
    useCallback(() => {
      triggerFestivalGreetingRecheck();
    }, [])
  );
  const [dateKey, setDateKey] = useState(dateKeyToday());
  const cached = dashboardCache?.key === dateKey ? dashboardCache.data : null;
  const [data, setData] = useState<DashboardResponse | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Mirrors Dashboard.aspx's kpiMissedPunches: the tile shows this MONTH's
  // total odd-swipe-count employees (GetPartialSummary's totalEmployees),
  // not "today's still-clocked-in" (kpis.missedPunchToday is a different,
  // unrelated metric) — always current month, independent of the dashboard's
  // own day picker, same as the .NET card.
  const [missedPunchesTotal, setMissedPunchesTotal] = useState<number | null>(null);
  const [unreadImportantEmails, setUnreadImportantEmails] = useState<number | null>(null);

  const load = useCallback(async (key: string) => {
    try {
      const res = await getDashboard(key);
      dashboardCache = { key, data: res.data };
      setData(res.data);
    } catch {
      /* non-fatal — keep showing previous data if any */
    }
    getMissedPunches()
      .then((res) => setMissedPunchesTotal(res.data.totalEmployees))
      .catch(() => {});
    getEmailInboxUnreadCount()
      .then((res) => setUnreadImportantEmails(res.data.unreadImportantCount))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Cached data (e.g. navigating back from a drilldown) renders immediately —
    // this fetch just silently refreshes it in the background, no spinner.
    if (!(dashboardCache?.key === dateKey)) setLoading(true);
    load(dateKey).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(dateKey);
    setRefreshing(false);
  };

  const openDrillDown = (title: string, rows: DrillDownRow[]) => {
    navigate('DrillDown', { title, rows, selectedDate: dateKey });
  };

  const handleKpiPress = async (def: KpiDef) => {
    if (!def.clickable || !data) return;

    if (def.key === 'missedPunches') {
      navigate('MissedPunches', { title: 'Missed Punches' });
      return;
    }

    if (def.key === 'totalEmployees') {
      navigate('EmployeeBreakdown', { title: 'Total Employees' });
      return;
    }

    if ((def.key as string) === 'overdueReceivable') {
      setBusyKey(def.key as string);
      try {
        const res = await getOverdueReceivables();
        navigate('OverdueReceivables', { title: 'Overdue Receivable', items: res.data.items });
      } finally {
        setBusyKey(null);
      }
      return;
    }

    if (def.listKey) {
      const rows = rowsFrom(data.lists[def.listKey], SUB_BUILDERS[def.listKey] || (() => ''), BADGE_BUILDERS[def.listKey]);
      openDrillDown(def.title, rows);
    }
  };

  const openDeptBox = (dept: DeptSection, kind: 'total' | 'onLeave' | 'absent') => {
    const items = kind === 'total' ? dept.totalEmps : kind === 'onLeave' ? dept.onLeaveEmps : dept.absentEmps;
    openDrillDown(
      `${dept.deptName} — ${kind === 'total' ? 'Total' : kind === 'onLeave' ? 'On Leave' : 'Absent'}`,
      items.map((i) => ({ employeeId: i.employeeId, name: i.name, sub: i.sub, designation: i.designation }))
    );
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.dateBar}>
        <Pressable style={styles.dateNavBtn} onPress={() => setDateKey((k) => addDaysToKey(k, -1))}>
          <Icon name="chevronLeft" size={18} color={A.ink} />
        </Pressable>
        <Text style={styles.dateText} numberOfLines={1}>
          {fmtDateLong(dateKey)}
        </Text>
        <Pressable style={styles.dateNavBtn} onPress={() => setDateKey((k) => addDaysToKey(k, 1))} disabled={dateKey >= dateKeyToday()}>
          <Icon name="chevronRight" size={18} color={dateKey >= dateKeyToday() ? A.border : A.ink} />
        </Pressable>
      </View>

      {/* Early Going / Half Day cards below look at the PREVIOUS day, not the date picked above — this note carries that context, matching Dashboard.aspx's persistent dash-early-note. */}
      {data && <Text style={styles.earlyGoingNote}>Early Going data from: {fmtDateShort(data.earlyGoingDate)}</Text>}

      {data && (
        <View style={styles.kpiGrid}>
          {KPI_DEFS.map((def) => {
            const value =
              def.key === 'missedPunches' ? missedPunchesTotal ?? '—' : (data.kpis as any)[def.key === ('overdueReceivable' as any) ? 'overdueCount' : def.key];
            const displayValue = def.key === ('overdueReceivable' as any) ? `₹${data.kpis.overdueAmount.toLocaleString('en-IN')}` : def.key === 'attendancePct' ? `${value}%` : String(value);
            const isBusy = busyKey === (def.key as string);
            return (
              <Pressable
                key={def.title}
                style={[styles.kpiCard, !def.clickable && styles.kpiCardStatic]}
                onPress={() => handleKpiPress(def)}
                disabled={!def.clickable || isBusy}
              >
                <View style={[styles.kpiIcon, { backgroundColor: def.color + '1f' }]}>
                  {isBusy ? <ActivityIndicator size="small" color={def.color} /> : <Icon name={def.icon} size={20} color={def.color} />}
                </View>
                <Text style={[styles.kpiValue, { color: def.color }]} numberOfLines={1}>
                  {displayValue}
                </Text>
                <Text style={styles.kpiTitle} numberOfLines={2}>
                  {def.title}
                </Text>
                {def.key === 'arrivedToday' && (
                  <Text style={styles.kpiSub}>{data.kpis.attendancePct}% of {data.kpis.bioTotal} enrolled</Text>
                )}
                {(def.key === 'earlyGoing' || def.key === 'halfDay') && (
                  <Text style={styles.kpiSub}>Prev day: {fmtDateShort(data.earlyGoingDate)}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.deptSectionsWrap}>
        <Text style={styles.sectionHeading}>Other Dashboards</Text>
        <View style={styles.moduleRow}>
          <ModuleCard title="Sales Dashboard" sub="Sales analysis & reports" icon="barTrend" color="#10b981" onPress={() => navigate('SalesReportsHub')} />
          <ModuleCard
            title="Email Dashboard"
            sub={unreadImportantEmails ? `${unreadImportantEmails} unread important` : 'View inbox'}
            icon="mail"
            color="#e11d48"
            onPress={() => navigate('EmailInbox')}
            badgeCount={unreadImportantEmails}
          />
        </View>
      </View>

      {data && (
        <View style={styles.deptSectionsWrap}>
          <Text style={styles.sectionHeading}>Employee Status</Text>
          <View style={styles.statusGrid}>
            <StatusBox
              label="Active"
              value={data.employmentStatusCounts.active}
              tint="#15803d"
              tintBg="#dcfce7"
              onPress={() => navigate('Employees', { initialStatus: 'Active' })}
            />
            <StatusBox
              label="Inactive"
              value={data.employmentStatusCounts.inactive}
              tint="#6b7280"
              tintBg="#f3f4f6"
              onPress={() => navigate('Employees', { initialStatus: 'Inactive' })}
            />
            <StatusBox
              label="Left"
              value={data.employmentStatusCounts.left}
              tint="#b91c1c"
              tintBg="#fee2e2"
              onPress={() => navigate('Employees', { initialStatus: 'Left' })}
            />
            <StatusBox
              label="Terminated"
              value={data.employmentStatusCounts.terminated}
              tint="#b91c1c"
              tintBg="#fee2e2"
              onPress={() => navigate('Employees', { initialStatus: 'Terminated' })}
            />
          </View>
        </View>
      )}

      {data && data.deptSections.length > 0 && (
        <View style={styles.deptSectionsWrap}>
          <Text style={styles.sectionHeading}>Department Attendance</Text>
          {data.deptSections.map((dept) => (
            <View key={dept.deptName} style={styles.deptCard}>
              <Text style={styles.deptName}>{dept.deptName}</Text>
              <View style={styles.deptBoxRow}>
                <DeptBox label="On Leave" value={dept.onLeave} tint="#991b1b" onPress={() => openDeptBox(dept, 'onLeave')} />
                <DeptBox label="Absent" value={dept.absent} tint="#b91c1c" onPress={() => openDeptBox(dept, 'absent')} />
                <DeptBox label="Total" value={dept.total} tint="#1e3a6e" onPress={() => openDeptBox(dept, 'total')} />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function DeptBox({ label, value, tint, onPress }: { label: string; value: number; tint: string; onPress: () => void }) {
  return (
    <Pressable style={styles.deptBox} onPress={onPress}>
      <Text style={[styles.deptBoxValue, { color: tint }]}>{value}</Text>
      <Text style={styles.deptBoxLabel}>{label}</Text>
    </Pressable>
  );
}

function ModuleCard({
  title,
  sub,
  icon,
  color,
  onPress,
  badgeCount,
}: {
  title: string;
  sub: string;
  icon: IconName;
  color: string;
  onPress: () => void;
  badgeCount?: number | null;
}) {
  return (
    <Pressable style={styles.moduleCard} onPress={onPress}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '1f' }]}>
        <Icon name={icon} size={20} color={color} />
        {/* Same red count bubble as the Email Inbox row on the Home tab (ModuleMenuScreen's MenuRow). */}
        {!!badgeCount && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.moduleTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.kpiSub} numberOfLines={2}>
        {sub}
      </Text>
    </Pressable>
  );
}

function StatusBox({ label, value, tint, tintBg, onPress }: { label: string; value: number; tint: string; tintBg: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.statusBox, { backgroundColor: tintBg }]} onPress={onPress}>
      <Text style={[styles.statusBoxValue, { color: tint }]}>{value}</Text>
      <Text style={[styles.statusBoxLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  dateNavBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  dateText: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: A.ink },
  earlyGoingNote: { fontSize: 11, color: A.muted, textAlign: 'center', marginBottom: spacing(2) },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing(3) },
  kpiCard: {
    width: '47%',
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 14,
    ...shadow.card,
  },
  kpiCardStatic: { opacity: 0.92 },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue: { fontSize: 24, fontWeight: '800' },
  kpiTitle: { fontSize: 11, color: A.muted, fontWeight: '600', marginTop: 2 },
  kpiSub: { fontSize: 10, color: A.muted, marginTop: 4 },

  sectionHeading: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  deptSectionsWrap: { marginBottom: spacing(2) },
  deptCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.card },
  deptName: { fontSize: 14, fontWeight: '800', color: A.ink, marginBottom: 10 },
  deptBoxRow: { flexDirection: 'row', gap: 8 },
  deptBox: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: A.surfaceRaised },
  deptBoxValue: { fontSize: 20, fontWeight: '800' },
  deptBoxLabel: { fontSize: 10, color: A.muted, marginTop: 2 },

  moduleRow: { flexDirection: 'row', gap: 10 },
  moduleCard: { flex: 1, backgroundColor: A.surface, borderRadius: radius.md, padding: 14, ...shadow.card },
  moduleTitle: { fontSize: 14, fontWeight: '800', color: A.ink },
  cardBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: A.surface,
  },
  cardBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff' },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusBox: { width: '47%', alignItems: 'center', paddingVertical: 14, borderRadius: radius.md, ...shadow.card },
  statusBoxValue: { fontSize: 22, fontWeight: '800' },
  statusBoxLabel: { fontSize: 11, fontWeight: '700', marginTop: 4 },
});
