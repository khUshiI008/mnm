import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import { colors, spacing } from '../../theme';
import { AttendanceDay, AttendanceSummary, getMonthlyAttendance, getTodayStatus } from '../../api/attendanceApi';
import { useSelfieCapture } from '../../hooks/useSelfieCapture';

// Attendance tracking goes live 1 July 2026 — same GO_LIVE constraint the
// .NET Employee/Attendance.aspx.cs page enforces on its year/month dropdowns.
const GO_LIVE_YEAR = 2026;
const GO_LIVE_MONTH = 7;

function currentPeriod() {
  const now = new Date();
  if (now.getFullYear() < GO_LIVE_YEAR) return { year: GO_LIVE_YEAR, month: GO_LIVE_MONTH };
  if (now.getFullYear() === GO_LIVE_YEAR && now.getMonth() + 1 < GO_LIVE_MONTH) {
    return { year: GO_LIVE_YEAR, month: GO_LIVE_MONTH };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function AttendanceScreen({ route }: any) {
  const [period, setPeriod] = useState(currentPeriod());
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSelfie, setNeedsSelfie] = useState(false);

  const { capturing, capture: captureSelfie } = useSelfieCapture((type, success, message) => {
    if (success) {
      Alert.alert('Saved', message);
      if (type === 'checkin') setNeedsSelfie(false);
      load();
    } else {
      Alert.alert('Not saved', message);
    }
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [monthly, today] = await Promise.all([
        getMonthlyAttendance(period.year, period.month),
        getTodayStatus().catch(() => null),
      ]);
      setSummary(monthly.data.summary);
      setDays(monthly.data.days);
      setSource(monthly.data.source);
      if (today) setNeedsSelfie(today.data.needsCheckInSelfie);
    } catch (err: any) {
      Alert.alert('Could not load attendance', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (route?.params?.openSelfie === 'checkin') captureSelfie('checkin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.periodRow}>
        <Button title="< Prev" variant="outline" onPress={() => shiftMonth(-1)} />
        <Text style={styles.periodLabel}>
          {monthName(period.month)} {period.year}
        </Text>
        <Button title="Next >" variant="outline" onPress={() => shiftMonth(1)} />
      </View>

      {needsSelfie && (
        <Card style={styles.selfieCard}>
          <Text style={styles.selfieText}>You've punched in today but haven't submitted your check-in selfie yet.</Text>
          <Button title="Capture check-in selfie" onPress={() => captureSelfie('checkin')} loading={capturing === 'checkin'} />
        </Card>
      )}

      {summary && (
        <Card style={styles.summaryCard}>
          <SummaryStat label="Present" value={summary.present} color={colors.present} />
          <SummaryStat label="Late" value={summary.late} color={colors.late} />
          <SummaryStat label="Absent" value={summary.absent} color={colors.absent} />
          <SummaryStat label="Partial" value={summary.partial} color={colors.partial} />
          <SummaryStat label="%" value={summary.attendancePct} color={colors.primary} />
        </Card>
      )}

      <Text style={styles.sourceLabel}>Source: {source || '—'}</Text>

      <FlatList
        data={days}
        keyExtractor={(d) => d.date}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: spacing(4) }}
        renderItem={({ item }) => (
          <Card style={styles.dayCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayDate}>
                {item.date} · {item.dayName}
              </Text>
              <Text style={styles.dayTimes}>
                {item.checkIn || '—'} → {item.checkOut || '—'} {item.duration ? `(${item.duration})` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <StatusBadge statusCss={item.statusCss} label={item.statusLabel} />
              {item.hasExcessBreak ? <StatusBadge statusCss="excess" label="Excess Break" /> : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No records for this month yet.</Text> : null}
      />

      <Button title="Capture break selfie" variant="outline" onPress={() => captureSelfie('break')} loading={capturing === 'break'} />
    </View>
  );

  function shiftMonth(delta: number) {
    setPeriod((p) => {
      let month = p.month + delta;
      let year = p.year;
      if (month < 1) {
        month = 12;
        year -= 1;
      } else if (month > 12) {
        month = 1;
        year += 1;
      }
      if (year < GO_LIVE_YEAR || (year === GO_LIVE_YEAR && month < GO_LIVE_MONTH)) {
        return { year: GO_LIVE_YEAR, month: GO_LIVE_MONTH };
      }
      return { year, month };
    });
  }
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function monthName(m: number) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][
    m - 1
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing(2) },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  periodLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  selfieCard: { backgroundColor: '#FFF6E5', marginBottom: spacing(2) },
  selfieText: { color: colors.warning, marginBottom: spacing(1), fontSize: 13 },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing(1) },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sourceLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(1), marginLeft: 4 },
  dayCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  dayDate: { fontWeight: '700', color: colors.text },
  dayTimes: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing(4) },
});
