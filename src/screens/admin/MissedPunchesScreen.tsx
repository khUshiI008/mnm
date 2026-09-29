import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import PunchCorrectionModal, { EditablePunch } from '../../components/admin/PunchCorrectionModal';
import { colors, radius, shadow, spacing } from '../../theme';
import { getMissedPunches, MissedPunchDateGroup, MissedPunchEmployee } from '../../api/adminDashboardApi';
import { getPartialPunches, savePartialCorrection } from '../../api/adminBiometricReportApi';

const A = colors.admin;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function changeMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

const PUNCH_COLOR: Record<string, { bg: string; text: string }> = {
  in: { bg: '#dcfce7', text: '#166534' },
  out: { bg: '#fee2e2', text: '#991b1b' },
  unmatched: { bg: '#ffedd5', text: '#9a3412' },
};

/**
 * Mirrors Panel/Dashboard.aspx's Missed Punches modal — a two-step drill-down
 * (dates list -> that date's employees) instead of the generic single-list
 * DrillDown screen, plus the same "Fix" action (reuses the exact correction
 * mechanism BiometricPartialScreen already uses — partial-punches /
 * partial-correction, i.e. .NET's GetCorrectionPunches/SaveCorrectionPunches).
 */
export default function MissedPunchesScreen() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [data, setData] = useState<{ totalDates: number; totalEmployees: number; dates: MissedPunchDateGroup[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [corr, setCorr] = useState<{ empId: number; date: string; empName: string; punches: EditablePunch[] } | null>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await getMissedPunches(m);
      setData({ totalDates: res.data.totalDates, totalEmployees: res.data.totalEmployees, dates: res.data.dates });
    } catch {
      Alert.alert('Could not load missed punches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedDate(null);
    load(month);
  }, [month, load]);

  const openFix = async (emp: MissedPunchEmployee, date: string) => {
    try {
      const res = await getPartialPunches(emp.empId, date);
      setCorr({
        empId: emp.empId,
        date,
        empName: emp.empName,
        punches: res.data.punches.map((p) => ({ time: p.time, source: p.source, readOnly: p.source === 'device' })),
      });
    } catch {
      Alert.alert('Could not load punches for this employee/date.');
    }
  };

  const currentGroup = data?.dates.find((d) => d.date === selectedDate) || null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonth((m) => changeMonth(m, -1))} style={styles.navBtn}>
          <Icon name="chevronLeft" size={16} color={A.ink} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth((m) => changeMonth(m, 1))} style={styles.navBtn}>
          <Icon name="chevronRight" size={16} color={A.ink} />
        </Pressable>
      </View>

      {!currentGroup ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Missed punch = odd swipe count on a day (unmatched IN punch). The biometric device database is never modified — corrections are stored in HRMS and merged with live data on
              every load.
            </Text>
          </View>

          {!data || data.dates.length === 0 ? (
            <Text style={styles.emptyText}>No missed punches this month.</Text>
          ) : (
            data.dates.map((d) => (
              <Pressable key={d.date} style={styles.dateRow} onPress={() => setSelectedDate(d.date)}>
                <Text style={styles.dateLabel}>{d.dateLabel}</Text>
                <View style={styles.dateRight}>
                  <Text style={styles.dateCount}>
                    {d.count} employee{d.count === 1 ? '' : 's'}
                  </Text>
                  <Icon name="chevronRight" size={16} color={A.muted} />
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.backRow} onPress={() => setSelectedDate(null)}>
            <Icon name="chevronLeft" size={16} color={A.primary} />
            <Text style={styles.backText}>All dates</Text>
          </Pressable>
          <Text style={styles.detailDateLabel}>{currentGroup.dateLabel}</Text>

          {currentGroup.employees.map((emp) => (
            <View key={emp.empId} style={styles.empCard}>
              <View style={styles.empHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{emp.empName}</Text>
                  <Text style={styles.empMeta}>
                    {emp.empCode} · Bio: {emp.bioCode}
                  </Text>
                </View>
                <Pressable style={styles.fixBtn} onPress={() => openFix(emp, currentGroup.date)}>
                  <Text style={styles.fixBtnText}>Fix</Text>
                </Pressable>
              </View>
              <View style={styles.punchChipRow}>
                {emp.punches.map((p, i) => (
                  <View key={i} style={[styles.punchChip, { backgroundColor: PUNCH_COLOR[p.type].bg }]}>
                    <Text style={[styles.punchChipText, { color: PUNCH_COLOR[p.type].text }]}>{p.time}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {corr && (
        <PunchCorrectionModal
          visible
          title={`Correct Punches — ${corr.empName}`}
          meta={corr.date}
          punches={corr.punches}
          showRemarks
          onClose={() => setCorr(null)}
          onSave={async (times, remarks) => {
            // Device punches are read-only (unchanged), so exclude them — only
            // correction-only times get submitted, matching .NET's behavior.
            const deviceTimes = new Set(corr.punches.filter((p) => p.source === 'device').map((p) => p.time));
            const correctionTimes = times.filter((t) => !deviceTimes.has(t));
            await savePartialCorrection(corr.empId, corr.date, correctionTimes, remarks);
            setCorr(null);
            await load(month);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing(2), paddingTop: spacing(2) },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  monthLabel: { fontSize: 14, fontWeight: '800', color: A.ink },

  hintBox: { backgroundColor: '#fff7ed', borderRadius: radius.sm, padding: 12, marginBottom: 14 },
  hintText: { fontSize: 11, color: '#9a3412', lineHeight: 17 },
  emptyText: { fontSize: 13, color: A.muted, textAlign: 'center', marginTop: spacing(4) },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  dateLabel: { fontSize: 13, fontWeight: '700', color: A.ink },
  dateRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateCount: { fontSize: 12, color: A.muted, fontWeight: '600' },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { fontSize: 13, fontWeight: '700', color: A.primary },
  detailDateLabel: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 14 },

  empCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.card },
  empHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  empName: { fontSize: 13, fontWeight: '800', color: A.ink },
  empMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  fixBtn: { backgroundColor: A.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  fixBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  punchChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  punchChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  punchChipText: { fontSize: 11, fontWeight: '700' },
});
