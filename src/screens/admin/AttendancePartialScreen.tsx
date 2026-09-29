import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import DateField from '../../components/DateField';
import EmployeeFilterModal, { EmployeeOption } from '../../components/admin/EmployeeFilterModal';
import PunchCorrectionModal, { EditablePunch } from '../../components/admin/PunchCorrectionModal';
import { colors, radius, shadow, spacing } from '../../theme';
import { getEmployees, getPartial, getPunches, PartialRow, saveCorrection } from '../../api/adminAttendanceReportApi';

const A = colors.admin;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AttendancePartialScreen() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(fmtDate(first));
  const [to, setTo] = useState(fmtDate(today));
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<PartialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [corr, setCorr] = useState<{ empId: number; date: string; empName: string; punches: EditablePunch[] } | null>(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await getPartial({ from, to, empId: employee?.employeeId || null, page: p, pageSize: 20 });
      setRows(res.data.rows);
      setTotal(res.data.total);
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

  const openCorrection = async (row: PartialRow) => {
    const res = await getPunches(row.employeeId, row.date);
    setCorr({ empId: row.employeeId, date: row.date, empName: row.empName, punches: res.data.punches.map((p) => ({ time: p.time, source: 'manual' })) });
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
          <Pressable style={styles.applyBtn} onPress={() => load(0)}>
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </Pressable>
        </View>

        {total > 0 && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              {total} partial record{total === 1 ? '' : 's'} found — each represents an employee-day with an unmatched punch (odd count). Use Edit to correct punches and re-process the day.
            </Text>
          </View>
        )}

        {rows.map((r) => (
          <View key={r.attendanceId} style={styles.rowCard}>
            <View style={styles.rowTop}>
              <Text style={styles.rowEmp}>
                {r.empCode} — {r.empName}
              </Text>
              <Pressable onPress={() => openCorrection(r)}>
                <Text style={styles.editLink}>Edit Punches</Text>
              </Pressable>
            </View>
            <Text style={styles.rowDate}>{r.date}</Text>
            <View style={styles.chipRow}>
              {r.punches.map((p, i) => (
                <View key={i} style={[styles.pchip, i % 2 === 0 && i === r.punches.length - 1 ? styles.pchipUnmatched : i % 2 === 0 ? styles.pchipIn : styles.pchipOut]}>
                  <Text style={styles.pchipText}>{p}</Text>
                </View>
              ))}
              {r.punches.length === 0 && <Text style={styles.rowMeta}>No raw punches</Text>}
            </View>
          </View>
        ))}

        {rows.length === 0 && !loading && <Text style={styles.emptyText}>No partial attendance records found for the selected filters.</Text>}

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
          showRemarks
          onClose={() => setCorr(null)}
          onSave={async (times, remarks) => {
            await saveCorrection(corr.empId, corr.date, times, remarks);
            setCorr(null);
            load(page);
          }}
        />
      )}
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
  applyBtn: { backgroundColor: A.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  alertBox: { backgroundColor: '#fff7ed', borderRadius: radius.sm, padding: 12, marginBottom: 12 },
  alertText: { fontSize: 11, color: '#9a3412', lineHeight: 17 },

  rowCard: { backgroundColor: A.surface, borderRadius: radius.sm, padding: 12, marginBottom: 8, ...shadow.card },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEmp: { fontSize: 12, fontWeight: '700', color: A.ink, flex: 1 },
  rowDate: { fontSize: 11, color: A.muted, marginTop: 2, marginBottom: 8 },
  rowMeta: { fontSize: 11, color: A.muted },
  editLink: { fontSize: 11, fontWeight: '700', color: A.primary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pchip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pchipIn: { backgroundColor: '#dcfce7' },
  pchipOut: { backgroundColor: '#fee2e2' },
  pchipUnmatched: { backgroundColor: '#ffedd5' },
  pchipText: { fontSize: 10, fontWeight: '700', color: A.ink },

  emptyText: { fontSize: 12, color: A.muted, textAlign: 'center', paddingVertical: 24 },

  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },
});
