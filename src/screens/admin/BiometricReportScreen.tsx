import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import DateField from '../../components/DateField';
import EmployeeFilterModal, { EmployeeOption } from '../../components/admin/EmployeeFilterModal';
import PunchCorrectionModal, { EditablePunch } from '../../components/admin/PunchCorrectionModal';
import { colors, radius, shadow, spacing } from '../../theme';
import { BiometricReportRow, BioReportKpi, getEmployees, getPunches, getReport, saveCorrection } from '../../api/adminBiometricReportApi';

const A = colors.admin;
const STATUSES = ['', 'Present', 'Late', 'Partial', 'Absent', 'EarlyGoing'];
const STATUS_LABEL: Record<string, string> = { '': 'All', Present: 'On Time', Late: 'Late', Partial: 'Partial', Absent: 'Absent', EarlyGoing: 'Early Going' };

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function statusColor(status: string) {
  switch (status) {
    case 'Present':
      return '#15803d';
    case 'Late':
      return '#a16207';
    case 'Partial':
      return '#c2410c';
    case 'Absent':
      return '#b91c1c';
    case 'Weekend':
      return '#64748b';
    default:
      return '#94a3b8';
  }
}

export default function BiometricReportScreen() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(fmtDate(first));
  const [to, setTo] = useState(fmtDate(today));
  const [status, setStatus] = useState('');
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<BiometricReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState<BioReportKpi | null>(null);
  const [loading, setLoading] = useState(false);
  const [corr, setCorr] = useState<{ empId: number; date: string; empName: string; punches: EditablePunch[] } | null>(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await getReport({ from, to, empId: employee?.employeeId || null, status: status || null, page: p, pageSize: 20 });
      setRows(res.data.rows);
      setTotal(res.data.total);
      setKpi(res.data.kpi);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getEmployees().then((r) => setEmployees(r.data.employees));
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCorrection = async (row: BiometricReportRow) => {
    const res = await getPunches(row.empId, row.date);
    setCorr({ empId: row.empId, date: row.date, empName: row.empName, punches: res.data.punches.map((p) => ({ time: p.time, source: p.source })) });
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(0)} />}>
        <View style={styles.filterCard}>
          <View style={styles.dateRow}>
            <DateField granularity="day" value={from} onChange={setFrom} placeholder="From" style={styles.dateFieldWrap} inputStyle={styles.dateInput} />
            <DateField granularity="day" value={to} onChange={setTo} placeholder="To" style={styles.dateFieldWrap} inputStyle={styles.dateInput} />
          </View>
          <Pressable style={styles.empPicker} onPress={() => setShowEmpModal(true)}>
            <Text style={styles.empPickerText}>{employee ? `${employee.code} — ${employee.name}` : 'All Employees'}</Text>
            <Icon name="chevronDown" size={14} color={A.muted} />
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{STATUS_LABEL[s]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.applyBtn} onPress={() => load(0)}>
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </Pressable>
          <Text style={styles.liveNote}>Computed live from biometric device data. The device database is never modified — corrections are stored separately.</Text>
        </View>

        {kpi && (
          <View style={styles.kpiGrid}>
            <KpiCard label="Total" value={kpi.total} />
            <KpiCard label="On Time" value={kpi.present} pct={kpi.presentPct} tone="#15803d" />
            <KpiCard label="Late" value={kpi.late} pct={kpi.latePct} tone="#a16207" />
            <KpiCard label="Partial" value={kpi.partial} pct={kpi.partialPct} tone="#c2410c" />
            <KpiCard label="Absent" value={kpi.absent} pct={kpi.absentPct} tone="#b91c1c" />
            <KpiCard label="Early Going" value={kpi.earlyGoing} pct={kpi.earlyGoingPct} tone="#0d9488" />
          </View>
        )}
        {kpi && (
          <View style={styles.avgCard}>
            <Text style={styles.avgLabel}>Avg Work / Day</Text>
            <Text style={styles.avgValue}>{kpi.avgWorkDisplay}</Text>
          </View>
        )}

        {rows.map((r) => (
          <View key={`${r.empId}_${r.date}`} style={styles.rowCard}>
            <View style={styles.rowTop}>
              <Text style={styles.rowEmp}>
                {r.empCode} — {r.empName}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(r.status) + '22' }]}>
                <Text style={[styles.statusText, { color: statusColor(r.status) }]}>{r.status}</Text>
              </View>
            </View>
            <Text style={styles.rowDate}>
              {r.date} · {r.swipeCount} swipe{r.swipeCount === 1 ? '' : 's'}
            </Text>
            <View style={styles.rowMetaLine}>
              <Text style={styles.rowMeta}>
                In {r.firstIn || '—'} · Out {r.lastOut || '—'} · {r.netWorkDisplay}
                {r.isEarlyGoing ? ' · Early Going' : ''}
              </Text>
              <Pressable onPress={() => openCorrection(r)}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {rows.length === 0 && !loading && <Text style={styles.emptyText}>No biometric records found for the selected filters.</Text>}

        {total > 20 && (
          <View style={styles.pagerRow}>
            <Pressable disabled={page <= 0} onPress={() => load(page - 1)} style={styles.pageBtn}>
              <Icon name="chevronLeft" size={16} color={page <= 0 ? A.border : A.ink} />
            </Pressable>
            <Text style={styles.pageInfo}>
              Page {page + 1} of {totalPages}
            </Text>
            <Pressable disabled={page >= totalPages - 1} onPress={() => load(page + 1)} style={styles.pageBtn}>
              <Icon name="chevronRight" size={16} color={page >= totalPages - 1 ? A.border : A.ink} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      <EmployeeFilterModal visible={showEmpModal} employees={employees} onSelect={setEmployee} onClose={() => setShowEmpModal(false)} />

      {corr && (
        <PunchCorrectionModal
          visible
          title={`Edit Punches — ${corr.empName}`}
          meta={corr.date}
          punches={corr.punches}
          onClose={() => setCorr(null)}
          onSave={async (times) => {
            await saveCorrection(corr.empId, corr.date, times);
            setCorr(null);
            load(page);
          }}
        />
      )}
    </View>
  );
}

function KpiCard({ label, value, pct, tone }: { label: string; value: number; pct?: string; tone?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, tone && { color: tone }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {pct && <Text style={styles.kpiPct}>{pct}%</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  filterCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 14, ...shadow.card },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateFieldWrap: { flex: 1, marginBottom: 0 },
  dateInput: { borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 0 },
  empPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 8 },
  empPickerText: { fontSize: 12, color: A.ink, fontWeight: '600' },
  chipRow: { flexGrow: 0, flexShrink: 0, marginBottom: 10 },
  chipRowContent: { alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: A.surfaceRaised, marginRight: 6 },
  chipActive: { backgroundColor: A.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: A.muted },
  chipTextActive: { color: '#fff' },
  applyBtn: { backgroundColor: A.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  liveNote: { fontSize: 10, color: A.muted, marginTop: 10, lineHeight: 15 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  kpiCard: { width: '31%', backgroundColor: A.surface, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', ...shadow.card },
  kpiValue: { fontSize: 17, fontWeight: '800', color: A.ink },
  kpiLabel: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  kpiPct: { fontSize: 9, color: A.muted, marginTop: 1 },

  avgCard: { backgroundColor: A.surface, borderRadius: radius.sm, padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadow.card },
  avgLabel: { fontSize: 12, color: A.muted, fontWeight: '600' },
  avgValue: { fontSize: 15, fontWeight: '800', color: A.primary },

  rowCard: { backgroundColor: A.surface, borderRadius: radius.sm, padding: 12, marginBottom: 8, ...shadow.card },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEmp: { fontSize: 12, fontWeight: '700', color: A.ink, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  rowDate: { fontSize: 11, color: A.muted, marginTop: 2 },
  rowMetaLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  rowMeta: { fontSize: 11, color: A.ink, flex: 1 },
  editLink: { fontSize: 11, fontWeight: '700', color: A.primary },

  emptyText: { fontSize: 12, color: A.muted, textAlign: 'center', paddingVertical: 24 },

  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },
});
