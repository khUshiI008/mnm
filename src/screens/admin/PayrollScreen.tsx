import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  bulkSetPayrollVisibility,
  finalizePayroll,
  generatePayroll,
  getPayrollGrid,
  getPayrollMonths,
  getPayrollSlip,
  PayrollMonthOption,
  PayrollRow,
  PayrollSlipResponse,
  PayrollSummary,
  togglePayrollVisibility,
} from '../../api/adminPayrollApi';

const A = colors.admin;

export default function PayrollScreen() {
  const [months, setMonths] = useState<PayrollMonthOption[]>([]);
  const [lastCompletedMonth, setLastCompletedMonth] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [visBusyId, setVisBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [slipId, setSlipId] = useState<number | null>(null);

  const loadGrid = useCallback(async (month?: string) => {
    setLoading(true);
    try {
      const res = await getPayrollGrid(month);
      setRows(res.data.payrolls);
      setSummary(res.data.summary);
    } catch {
      Alert.alert('Could not load payroll');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getPayrollMonths().then((res) => {
      setMonths(res.data.months);
      setLastCompletedMonth(res.data.lastCompletedMonth);
      const initial = res.data.months[0]?.value || res.data.lastCompletedMonth;
      setSelectedMonth(initial);
      loadGrid(initial);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMonthChange = (v: string) => {
    setSelectedMonth(v);
    loadGrid(v);
  };

  const handleGenerate = () => {
    const monthLabel = months.find((m) => m.value === selectedMonth)?.label || lastCompletedMonth.slice(0, 7);
    Alert.alert('Generate Payroll?', `This will generate/regenerate payroll for all active payroll-eligible employees for ${monthLabel}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate',
        onPress: async () => {
          setGenerating(true);
          try {
            const res = await generatePayroll((selectedMonth || lastCompletedMonth).slice(0, 7));
            Alert.alert(res.data.failed > 0 ? 'Completed with errors' : 'Success', res.data.message);
            const monthsRes = await getPayrollMonths();
            setMonths(monthsRes.data.months);
            await loadGrid(res.data.month?.slice(0, 7) || selectedMonth);
          } catch (err: any) {
            Alert.alert('Could not generate', err?.response?.data?.message || 'Please try again.');
          } finally {
            setGenerating(false);
          }
        },
      },
    ]);
  };

  const handleFinalize = (row: PayrollRow) => {
    Alert.alert('Finalize this payroll?', `${row.employeeDisplay}'s payroll will be locked as Finalized.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finalize',
        onPress: async () => {
          setBusyId(row.payrollId);
          try {
            await finalizePayroll(row.payrollId);
            await loadGrid(selectedMonth);
          } catch (err: any) {
            Alert.alert('Could not finalize', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  // Visibility is deliberately independent of Finalize — an admin can release a
  // still-Generated payslip, or keep a Finalized one hidden.
  const handleToggleVisibility = async (row: PayrollRow) => {
    setVisBusyId(row.payrollId);
    try {
      const res = await togglePayrollVisibility(row.payrollId);
      setRows((prev) => prev.map((r) => (r.payrollId === row.payrollId ? { ...r, showToEmployee: res.data.showToEmployee } : r)));
    } catch (err: any) {
      Alert.alert('Could not update visibility', err?.response?.data?.message || 'Please try again.');
    } finally {
      setVisBusyId(null);
    }
  };

  const handleBulkVisibility = (visible: boolean) => {
    const monthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth.slice(0, 7);
    Alert.alert(
      visible ? 'Show all payslips?' : 'Hide all payslips?',
      `Every payroll record for ${monthLabel} will be ${visible ? 'made visible to' : 'hidden from'} the employees.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: visible ? 'Show All' : 'Hide All',
          onPress: async () => {
            setBulkBusy(true);
            try {
              const res = await bulkSetPayrollVisibility((selectedMonth || lastCompletedMonth).slice(0, 7), visible);
              Alert.alert('Done', res.data.message);
              await loadGrid(selectedMonth);
            } catch (err: any) {
              Alert.alert('Could not update', err?.response?.data?.message || 'Please try again.');
            } finally {
              setBulkBusy(false);
            }
          },
        },
      ]
    );
  };

  const filteredRows = search.trim() ? rows.filter((r) => r.employeeDisplay.toLowerCase().includes(search.trim().toLowerCase())) : rows;
  const visibleCount = rows.filter((r) => r.showToEmployee).length;

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View style={[styles.pickerWrap, { flex: 1, marginBottom: 0 }]}>
          <Picker selectedValue={selectedMonth} onValueChange={onMonthChange}>
            {months.map((m) => (
              <Picker.Item key={m.value} label={m.label} value={m.value} />
            ))}
            {months.length === 0 && lastCompletedMonth && <Picker.Item label="No payroll generated yet" value={lastCompletedMonth} />}
          </Picker>
        </View>
        <Pressable style={styles.genBtn} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.genBtnText}>Generate</Text>}
        </Pressable>
      </View>

      {summary && (
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{summary.empCount}</Text>
            <Text style={styles.kpiLabel}>Employees</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#15803d' }]}>₹{summary.totalGrossDisplay}</Text>
            <Text style={styles.kpiLabel}>Gross</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>₹{summary.totalDeductDisplay}</Text>
            <Text style={styles.kpiLabel}>Deductions</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>₹{summary.totalNetDisplay}</Text>
            <Text style={styles.kpiLabel}>Net</Text>
          </View>
        </View>
      )}

      {rows.length > 0 && (
        <View style={styles.visBar}>
          <Text style={styles.visBarLabel}>
            {visibleCount}/{rows.length} released to employees
          </Text>
          <View style={styles.visBarBtns}>
            <Pressable style={styles.visBarBtn} onPress={() => handleBulkVisibility(true)} disabled={bulkBusy}>
              <Text style={styles.visBarBtnText}>Show All</Text>
            </Pressable>
            <Pressable style={[styles.visBarBtn, styles.visBarBtnMuted]} onPress={() => handleBulkVisibility(false)} disabled={bulkBusy}>
              <Text style={[styles.visBarBtnText, styles.visBarBtnTextMuted]}>Hide All</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput style={styles.searchInput} placeholder="Search employee..." placeholderTextColor={A.muted} value={search} onChangeText={setSearch} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {filteredRows.length === 0 ? (
            <Text style={styles.emptyText}>No payroll records found for this month.</Text>
          ) : (
            filteredRows.map((row) => (
              <Pressable key={row.payrollId} style={styles.card} onPress={() => setSlipId(row.payrollId)}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.employeeDisplay}</Text>
                    <Text style={styles.sub}>{row.departmentName || '—'} · {row.designationName || '—'}</Text>
                  </View>
                  <View style={[styles.statusBadge, row.status === 'Finalized' && styles.statusBadgeFinalized]}>
                    <Text style={[styles.statusBadgeText, row.status === 'Finalized' && styles.statusBadgeTextFinalized]}>{row.status}</Text>
                  </View>
                </View>

                <Text style={[styles.amount, row.isRecovery && styles.amountRecovery]}>
                  {row.isRecovery ? 'RECOVERY: ' : ''}₹{row.netPayableDisplay}
                </Text>
                <Text style={styles.detailLine}>
                  Gross ₹{row.grossSalaryDisplay} − Deductions ₹{row.totalDeductionsDisplay}
                </Text>
                <Text style={styles.detailLine}>
                  {row.presentDays}P · {row.absentDays}A · {row.halfDays}HD · {row.lateDays}L
                </Text>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.visBtn, row.showToEmployee && styles.visBtnOn]}
                    onPress={() => handleToggleVisibility(row)}
                    disabled={visBusyId === row.payrollId}
                  >
                    {visBusyId === row.payrollId ? (
                      <ActivityIndicator size="small" color={row.showToEmployee ? '#15803d' : A.muted} />
                    ) : (
                      <Text style={[styles.visBtnText, row.showToEmployee && styles.visBtnTextOn]}>
                        {row.showToEmployee ? '● Visible to employee' : '○ Hidden from employee'}
                      </Text>
                    )}
                  </Pressable>
                  {row.status !== 'Finalized' && (
                    <Pressable style={styles.finalizeBtn} onPress={() => handleFinalize(row)} disabled={busyId === row.payrollId}>
                      {busyId === row.payrollId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.finalizeBtnText}>Finalize</Text>}
                    </Pressable>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {slipId != null && <SlipModal payrollId={slipId} onClose={() => setSlipId(null)} />}
    </View>
  );
}

function SlipModal({ payrollId, onClose }: { payrollId: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [slip, setSlip] = useState<PayrollSlipResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPayrollSlip(payrollId)
      .then((res) => setSlip(res.data))
      .catch(() => Alert.alert('Could not load salary slip'))
      .finally(() => setLoading(false));
  }, [payrollId]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          {loading || !slip ? (
            <ActivityIndicator size="large" color={A.primary} style={{ marginVertical: spacing(4) }} />
          ) : (
            <ScrollView>
              <Text style={styles.modalTitle}>Salary Slip</Text>
              <Text style={styles.slipEmpName}>{slip.employee.name} <Text style={styles.slipEmpCode}>· {slip.employee.code}</Text></Text>
              <Text style={styles.slipMeta}>{slip.employee.department} · {slip.employee.designation}</Text>
              <Text style={styles.slipMeta}>{slip.payrollMonthDisplay} · Generated {slip.generatedOnDisplay}</Text>

              <View style={styles.attGrid}>
                <AttCell label="Present" val={slip.attendance.present} />
                <AttCell label="Absent" val={slip.attendance.absent} warn={slip.attendance.absent > 5} />
                <AttCell label="Half Day" val={slip.attendance.halfDay} />
                <AttCell label="Late" val={slip.attendance.late} warn={slip.attendance.late > 0} />
                <AttCell label="Early" val={slip.attendance.early} />
                <AttCell label="WO Given" val={slip.attendance.woGiven} />
                <AttCell label="WO Worked" val={slip.attendance.woWorked} />
                <AttCell label="PL Used" val={slip.attendance.plUsed} warn={slip.attendance.plUsed > 0} />
              </View>

              <Text style={styles.absentExplain}>{slip.absentExplain}</Text>

              <Text style={styles.sectionTitle}>Earnings</Text>
              {slip.earnings.map((e, i) => (
                <View key={i} style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineHead}>{e.headName}</Text>
                    <Text style={styles.lineSub}>{e.calcDesc}</Text>
                  </View>
                  <Text style={styles.lineAmt}>₹{e.amountDisplay}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Gross Salary</Text>
                <Text style={styles.totalAmt}>₹{slip.grossSalaryDisplay}</Text>
              </View>

              <Text style={styles.sectionTitle}>Deductions</Text>
              {slip.deductions.length === 0 ? (
                <Text style={styles.lineSub}>No deductions.</Text>
              ) : (
                slip.deductions.map((d, i) => (
                  <View key={i} style={styles.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineHead}>{d.headName}</Text>
                      <Text style={styles.lineSub}>{d.basis}</Text>
                    </View>
                    <Text style={styles.lineAmt}>₹{d.amountDisplay}</Text>
                  </View>
                ))
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Deductions</Text>
                <Text style={[styles.totalAmt, { color: '#dc2626' }]}>₹{slip.totalDeductionsDisplay}</Text>
              </View>

              <View style={[styles.netBox, slip.isRecovery && styles.netBoxRecovery]}>
                <Text style={styles.netLabel}>{slip.isRecovery ? 'AMOUNT RECOVERABLE FROM EMPLOYEE' : 'NET PAYABLE SALARY'}</Text>
                <Text style={styles.netSub}>
                  {slip.payrollMonthDisplay} · Absent Rate: ₹{slip.absentRateDisplay}/day ({slip.calDays} days) · Std Days: {slip.standardDays}
                </Text>
                <Text style={[styles.netVal, slip.isRecovery && styles.netValRecovery]}>
                  {slip.isRecovery ? '-' : ''}₹{slip.isRecovery ? slip.recoveryAmountDisplay : slip.netPayableDisplay}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Button title="Close" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AttCell({ label, val, warn }: { label: string; val: number; warn?: boolean }) {
  return (
    <View style={styles.attCell}>
      <Text style={[styles.attVal, warn && styles.attValWarn]}>{val}</Text>
      <Text style={styles.attLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  topRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  genBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  genBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), paddingTop: spacing(1) },
  kpiCard: { flex: 1, backgroundColor: A.surface, borderRadius: radius.md, padding: 10, ...shadow.card },
  kpiValue: { fontSize: 14, fontWeight: '800', color: A.ink },
  kpiLabel: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600' },

  searchRow: { paddingHorizontal: spacing(2), paddingTop: spacing(1.5) },
  visBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: spacing(2), marginTop: spacing(1.5), padding: 10, borderRadius: radius.sm, backgroundColor: A.surface, ...shadow.card },
  visBarLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: A.muted },
  visBarBtns: { flexDirection: 'row', gap: 6 },
  visBarBtn: { height: 30, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, borderColor: '#86efac', backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  visBarBtnMuted: { borderColor: A.border, backgroundColor: A.surface },
  visBarBtnText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  visBarBtnTextMuted: { color: A.muted },
  searchInput: { height: 40, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  statusBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#1d4ed8' },
  statusBadgeFinalized: { backgroundColor: '#dcfce7' },
  statusBadgeTextFinalized: { color: '#15803d' },
  amount: { fontSize: 18, fontWeight: '800', color: A.ink },
  amountRecovery: { color: '#dc2626' },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 4 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  visBtn: { flex: 1, height: 36, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, borderColor: A.border, backgroundColor: A.surface, alignItems: 'center', justifyContent: 'center' },
  visBtnOn: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  visBtnText: { fontSize: 11, fontWeight: '700', color: A.muted },
  visBtnTextOn: { color: '#15803d' },
  finalizeBtn: { height: 36, paddingHorizontal: 16, borderRadius: 9, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  finalizeBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: 6 },
  slipEmpName: { fontSize: 15, fontWeight: '800', color: A.ink },
  slipEmpCode: { fontWeight: '500', color: A.muted },
  slipMeta: { fontSize: 12, color: A.muted, marginTop: 2 },

  attGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 10 },
  attCell: { width: '23%', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  attVal: { fontSize: 15, fontWeight: '800', color: A.ink },
  attValWarn: { color: '#dc2626' },
  attLbl: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600' },

  absentExplain: { fontSize: 11, color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, marginBottom: 14 },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.primary, marginTop: 10, marginBottom: 8, textTransform: 'uppercase' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: A.border },
  lineHead: { fontSize: 12, fontWeight: '700', color: A.ink },
  lineSub: { fontSize: 10, color: A.muted, marginTop: 2 },
  lineAmt: { fontSize: 12, fontWeight: '700', color: A.ink },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 6 },
  totalLabel: { fontSize: 13, fontWeight: '800', color: A.ink },
  totalAmt: { fontSize: 13, fontWeight: '800', color: A.ink },

  netBox: { backgroundColor: A.primary, borderRadius: radius.md, padding: 16, marginTop: 12, alignItems: 'center' },
  netBoxRecovery: { backgroundColor: '#dc2626' },
  netLabel: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  netSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 4, textAlign: 'center' },
  netVal: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  netValRecovery: { color: '#fff' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(2), marginBottom: spacing(2) },
});
