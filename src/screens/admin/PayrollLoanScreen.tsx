import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import {
  cancelPayrollLoan,
  createPayrollLoan,
  CreatePayrollLoanPayload,
  getPayrollLoanEmployees,
  getPayrollLoanGrid,
  getPayrollLoanScheduleGrid,
  PayrollLoanEmployee,
  PayrollLoanRow,
  PayrollLoanSchedulePreviewRow,
  PayrollLoanScheduleRow,
  previewPayrollLoanSchedule,
  skipPayrollLoanSchedule,
} from '../../api/adminPayrollLoanApi';

const A = colors.admin;
const MONTH_CSS_COLOR: Record<string, string> = { done: '#15803d', overdue: '#dc2626', today: '#d97706', soon: '#d97706', upcoming: '#6b7280' };

export default function PayrollLoanScreen({ params }: { params?: { openIssueModal?: boolean } }) {
  const { navigate } = useAdminNav();
  const [tab, setTab] = useState<'loans' | 'schedule'>('loans');
  const [search, setSearch] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [loans, setLoans] = useState<PayrollLoanRow[]>([]);
  const [loanCount, setLoanCount] = useState(0);
  const [totalDisbursed, setTotalDisbursed] = useState('0.00');
  const [schedules, setSchedules] = useState<PayrollLoanScheduleRow[]>([]);
  const [schedStats, setSchedStats] = useState({ pendingCount: 0, pendingAmountDisplay: '0.00', deductedThisMonthCount: 0, deductedThisMonthDisplay: '0.00' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [skippingId, setSkippingId] = useState<number | null>(null);
  // Auto-opens when arriving from the Loan Dashboard's "+ Add Loan" entry
  // point — see StaffLoanScreen.tsx's matching comment.
  const [showIssueModal, setShowIssueModal] = useState(!!params?.openIssueModal);

  const loadLoans = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getPayrollLoanGrid(term);
      setLoans(res.data.loans);
      setLoanCount(res.data.loanCount);
      setTotalDisbursed(res.data.totalDisbursedDisplay);
    } catch {
      Alert.alert('Could not load payroll advances');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getPayrollLoanScheduleGrid({ search: term || undefined });
      setSchedules(res.data.schedules);
      setSchedStats(res.data.stats);
    } catch {
      Alert.alert('Could not load deduction schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'loans') loadLoans(search || undefined);
    else loadSchedules(scheduleSearch || undefined);
  }, [tab, loadLoans, loadSchedules, search, scheduleSearch]);

  const handleCancel = (loan: PayrollLoanRow) => {
    Alert.alert('Cancel this advance?', `${loan.loanRef} for ${loan.empName} will be cancelled and its pending deductions removed.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Advance',
        style: 'destructive',
        onPress: async () => {
          setBusyId(loan.payrollOnLoanId);
          try {
            await cancelPayrollLoan(loan.payrollOnLoanId);
            await loadLoans(search || undefined);
          } catch (err: any) {
            Alert.alert('Could not cancel', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleSkip = (s: PayrollLoanScheduleRow) => {
    Alert.alert(
      `Skip ${s.salaryMonthDisplay} deduction?`,
      `${s.loanRef} — EMI ${s.emiNumber} of ${s.totalEMIs} (₹${s.deductionAmountDisplay}) will be moved to the month right after this advance's current last EMI. Nothing is waived — the advance just finishes one month later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip This Month',
          onPress: async () => {
            setSkippingId(s.scheduleId);
            try {
              const res = await skipPayrollLoanSchedule(s.scheduleId);
              Alert.alert('EMI Skipped', res.data.message || 'Moved to the end of the deduction schedule.');
              await loadSchedules(scheduleSearch || undefined);
            } catch (err: any) {
              Alert.alert('Could not skip', err?.response?.data?.message || 'Please try again.');
            } finally {
              setSkippingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'loans' && styles.tabBtnActive]} onPress={() => setTab('loans')}>
          <Text style={[styles.tabBtnText, tab === 'loans' && styles.tabBtnTextActive]}>Advances ({loanCount})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'schedule' && styles.tabBtnActive]} onPress={() => setTab('schedule')}>
          <Text style={[styles.tabBtnText, tab === 'schedule' && styles.tabBtnTextActive]}>Deductions ({schedStats.pendingCount})</Text>
        </Pressable>
      </View>

      {tab === 'loans' ? (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>₹{totalDisbursed}</Text>
              <Text style={styles.kpiLabel}>Active Principal</Text>
            </View>
          </View>

          <View style={styles.topRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search employee or ref..."
              placeholderTextColor={A.muted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => loadLoans(search || undefined)}
              returnKeyType="search"
            />
            <Pressable style={styles.addBtn} onPress={() => setShowIssueModal(true)}>
              <Text style={styles.addBtnText}>+ Issue</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {loans.length === 0 ? (
                <Text style={styles.emptyText}>No payroll advances found.</Text>
              ) : (
                loans.map((loan) => (
                  <Pressable key={loan.payrollOnLoanId} style={styles.card} onPress={() => navigate('PayrollLoanDetail', { loanId: loan.payrollOnLoanId })}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{loan.empName}</Text>
                        <Text style={styles.sub}>{loan.loanRef} · {loan.deptName}</Text>
                      </View>
                      <View style={[styles.statusBadge, loan.status !== 'Active' && styles.statusBadgeMuted]}>
                        <Text style={[styles.statusBadgeText, loan.status !== 'Active' && styles.statusBadgeTextMuted]}>{loan.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.amount}>₹{loan.loanAmountDisplay}</Text>
                    <View style={styles.progressBarWrap}>
                      <View style={[styles.progressBarFill, { width: `${loan.progressPct}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {loan.deductedEMIs}/{loan.totalEMIs} deducted · Paid ₹{loan.paidDisplay} · Outstanding ₹{loan.outstandingDisplay}
                    </Text>
                    {loan.overdueCount > 0 && <Text style={styles.overdueLine}>{loan.overdueCount} overdue EMI(s) · ₹{loan.overdueDisplay}</Text>}

                    {loan.status === 'Active' && (
                      <View style={styles.actionsRow}>
                        <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => handleCancel(loan)} disabled={busyId === loan.payrollOnLoanId}>
                          {busyId === loan.payrollOnLoanId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.cancelText}>Cancel</Text>}
                        </Pressable>
                        <Pressable style={styles.detailLink} onPress={() => navigate('PayrollLoanDetail', { loanId: loan.payrollOnLoanId })}>
                          <Text style={styles.detailLinkText}>Manage →</Text>
                        </Pressable>
                      </View>
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{schedStats.pendingCount}</Text>
              <Text style={styles.kpiLabel}>Pending ₹{schedStats.pendingAmountDisplay}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#15803d' }]}>{schedStats.deductedThisMonthCount}</Text>
              <Text style={styles.kpiLabel}>Deducted this month ₹{schedStats.deductedThisMonthDisplay}</Text>
            </View>
          </View>

          <View style={styles.topRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search employee or ref..."
              placeholderTextColor={A.muted}
              value={scheduleSearch}
              onChangeText={setScheduleSearch}
              onSubmitEditing={() => loadSchedules(scheduleSearch || undefined)}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {schedules.length === 0 ? (
                <Text style={styles.emptyText}>No deduction schedule found.</Text>
              ) : (
                schedules.map((s) => (
                  <View key={s.scheduleId} style={styles.emiRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emiEmp}>{s.employeeDisplay}</Text>
                      <Text style={styles.emiSub}>{s.loanRef} · EMI {s.emiNumber}/{s.totalEMIs}</Text>
                      <Text style={[styles.emiDue, { color: MONTH_CSS_COLOR[s.salaryMonthCss] }]}>{s.salaryMonthLabel} · {s.salaryMonthDisplay}</Text>
                    </View>
                    <View style={styles.emiRight}>
                      <Text style={styles.emiAmt}>₹{s.deductionAmountDisplay}</Text>
                      {s.status === 'Deducted' ? (
                        <Text style={styles.receivedTag}>Deducted</Text>
                      ) : s.isLocked ? (
                        <Text style={styles.lockedTag}>Locked</Text>
                      ) : (
                        <>
                          <Text style={styles.pendingTag}>Pending</Text>
                          <Pressable style={styles.skipBtn} disabled={skippingId === s.scheduleId} onPress={() => handleSkip(s)} hitSlop={6}>
                            {skippingId === s.scheduleId ? <ActivityIndicator size="small" color="#7c3aed" /> : <Text style={styles.skipBtnText}>Skip →</Text>}
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {showIssueModal && (
        <IssueLoanModal
          onClose={() => setShowIssueModal(false)}
          onSaved={() => {
            setShowIssueModal(false);
            loadLoans(search || undefined);
          }}
        />
      )}
    </View>
  );
}

function IssueLoanModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [employees, setEmployees] = useState<PayrollLoanEmployee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<PayrollLoanEmployee | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  // See StaffLoanScreen.tsx's matching comment — same two mutually
  // exclusive sizing modes.
  const [mode, setMode] = useState<'count' | 'amount'>('count');
  const [totalEMIs, setTotalEMIs] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [firstEMIMonth, setFirstEMIMonth] = useState('');
  const [disbursalDate, setDisbursalDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ schedule: PayrollLoanSchedulePreviewRow[]; totalEMIs: number; baseEMIDisplay: string; totalAmountDisplay: string } | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    getPayrollLoanEmployees().then((res) => setEmployees(res.data.employees)).catch(() => {});
  }, []);

  const filteredEmployees = empSearch.trim()
    ? employees.filter((e) => e.label.toLowerCase().includes(empSearch.trim().toLowerCase()))
    : employees;

  // Live EMI schedule preview — mirrors the .NET Issue Advance page's inline preview,
  // computed via the exact same backend math used at actual creation time so the two never disagree.
  useEffect(() => {
    const amt = Number(loanAmount);
    const emis = Number(totalEMIs);
    const monthly = Number(monthlyAmount);
    const sizingReady = mode === 'count' ? !!emis && emis >= 1 : !!monthly && monthly > 0;
    if (!amt || amt <= 0 || !sizingReady || !firstEMIMonth) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewPayrollLoanSchedule({
        employeeId: 0,
        loanAmount: amt,
        ...(mode === 'count' ? { totalEMIs: emis } : { monthlyAmount: monthly }),
        firstEMIMonth,
      })
        .then((res) => {
          if (cancelled) return;
          if (res.data.success && res.data.schedule) {
            setPreview({
              schedule: res.data.schedule,
              totalEMIs: res.data.totalEMIs || res.data.schedule.length,
              baseEMIDisplay: res.data.baseEMIDisplay || '0.00',
              totalAmountDisplay: res.data.totalAmountDisplay || '0.00',
            });
          } else {
            setPreview(null);
          }
        })
        .catch(() => !cancelled && setPreview(null))
        .finally(() => !cancelled && setPreviewLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [loanAmount, mode, totalEMIs, monthlyAmount, firstEMIMonth]);

  const save = async () => {
    if (!selectedEmp) return Alert.alert('Please select an employee.');
    const payload: CreatePayrollLoanPayload = {
      employeeId: selectedEmp.employeeId,
      loanAmount: Number(loanAmount),
      ...(mode === 'count' ? { totalEMIs: Number(totalEMIs) } : { monthlyAmount: Number(monthlyAmount) }),
      firstEMIMonth,
      disbursalDate,
      description,
    };
    setSaving(true);
    try {
      await createPayrollLoan(payload);
      Alert.alert('Advance Issued', 'Deduction schedule generated successfully.');
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not issue advance', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Issue Payroll Advance</Text>

            <TextField
              label="Employee *"
              placeholder="Search name or code..."
              value={selectedEmp ? selectedEmp.label : empSearch}
              onChangeText={(v) => { setSelectedEmp(null); setEmpSearch(v); }}
            />
            {empSearch.length > 0 && !selectedEmp && (
              <View style={styles.empResultsBox}>
                {filteredEmployees.length === 0 ? (
                  <Text style={styles.empResultEmpty}>No matching employees.</Text>
                ) : (
                  <>
                    {filteredEmployees.slice(0, 20).map((e) => (
                      <Pressable key={e.employeeId} style={styles.empResultRow} onPress={() => { setSelectedEmp(e); setEmpSearch(''); }}>
                        <Text style={styles.empResultText}>{e.label}</Text>
                      </Pressable>
                    ))}
                    {filteredEmployees.length > 20 && <Text style={styles.empResultEmpty}>Keep typing to narrow down further...</Text>}
                  </>
                )}
              </View>
            )}

            <TextField label="Advance Amount *" value={loanAmount} onChangeText={setLoanAmount} keyboardType="decimal-pad" />

            <Text style={styles.label}>Instalments</Text>
            <View style={styles.modeRow}>
              <Pressable style={[styles.modeBtn, mode === 'count' && styles.modeBtnActive]} onPress={() => setMode('count')}>
                <Text style={[styles.modeBtnText, mode === 'count' && styles.modeBtnTextActive]}>By Count</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, mode === 'amount' && styles.modeBtnActive]} onPress={() => setMode('amount')}>
                <Text style={[styles.modeBtnText, mode === 'amount' && styles.modeBtnTextActive]}>By Monthly Amount</Text>
              </Pressable>
            </View>
            {mode === 'count' ? (
              <TextField label="Number of Installments *" value={totalEMIs} onChangeText={setTotalEMIs} keyboardType="number-pad" />
            ) : (
              <>
                <TextField label="Monthly Instalment Amount *" value={monthlyAmount} onChangeText={setMonthlyAmount} keyboardType="decimal-pad" />
                <Text style={styles.modeHint}>
                  Number of instalments is worked out automatically. A leftover of up to ₹1000 is added to the last instalment; anything more becomes
                  one extra instalment the following month.
                </Text>
              </>
            )}
            <DateField label="First Deduction Month *" granularity="month" value={firstEMIMonth} onChange={setFirstEMIMonth} placeholder="Select month" />
            <DateField label="Disbursal Date" granularity="day" value={disbursalDate} onChange={setDisbursalDate} />
            <TextField label="Purpose / Description" value={description} onChangeText={setDescription} multiline numberOfLines={2} />

            {previewLoading ? (
              <ActivityIndicator size="small" color={A.primary} style={{ marginBottom: 16 }} />
            ) : preview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>EMI Schedule Preview</Text>
                <Text style={styles.previewSub}>
                  {preview.totalEMIs} installment{preview.totalEMIs === 1 ? '' : 's'}
                  {mode === 'count' ? ` · ₹${preview.baseEMIDisplay} each (last adjusted)` : ''} · Total ₹{preview.totalAmountDisplay}
                </Text>
                {preview.schedule.map((row) => (
                  <View key={row.emiNumber} style={styles.previewRow}>
                    <Text style={styles.previewRowNum}>#{row.emiNumber}</Text>
                    <Text style={styles.previewRowMonth}>{row.salaryMonthDisplay}</Text>
                    <Text style={styles.previewRowAmt}>₹{row.amountDisplay}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Issue Advance" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  tabRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  tabBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  tabBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: A.muted },
  tabBtnTextActive: { color: '#fff' },

  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), paddingTop: spacing(2) },
  kpiCard: { flex: 1, backgroundColor: A.surface, borderRadius: radius.md, padding: 12, ...shadow.card },
  kpiValue: { fontSize: 16, fontWeight: '800', color: A.ink },
  kpiLabel: { fontSize: 10, color: A.muted, marginTop: 2, fontWeight: '600' },

  topRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  searchInput: { flex: 1, height: 42, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  statusBadgeMuted: { backgroundColor: '#f1f5f9' },
  statusBadgeTextMuted: { color: A.muted },
  amount: { fontSize: 20, fontWeight: '800', color: A.ink, marginBottom: 8 },

  progressBarWrap: { height: 6, backgroundColor: A.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: A.primary },
  progressText: { fontSize: 11, color: A.muted },
  overdueLine: { fontSize: 11, color: '#dc2626', fontWeight: '700', marginTop: 4 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  actionBtn: { height: 36, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  cancelText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  detailLink: { paddingVertical: 8 },
  detailLinkText: { color: A.primary, fontWeight: '700', fontSize: 12 },

  emiRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  emiEmp: { fontSize: 13, fontWeight: '800', color: A.ink },
  emiSub: { fontSize: 11, color: A.muted, marginTop: 2 },
  emiDue: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  emiRight: { alignItems: 'flex-end', gap: 6 },
  emiAmt: { fontSize: 14, fontWeight: '800', color: A.ink },
  receivedTag: { fontSize: 11, color: '#15803d', fontWeight: '700' },
  lockedTag: { fontSize: 11, color: '#92400e', fontWeight: '700' },
  pendingTag: { fontSize: 11, color: '#d97706', fontWeight: '700' },
  skipBtn: { minWidth: 58, height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  skipBtnText: { fontSize: 11, fontWeight: '700', color: '#7c3aed' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  empResultsBox: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginTop: -8, marginBottom: 16, backgroundColor: A.surface },
  empResultRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  empResultText: { fontSize: 13, color: A.ink },
  empResultEmpty: { padding: 10, fontSize: 12, color: A.muted },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn: { flex: 1, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: A.border, backgroundColor: A.surface, alignItems: 'center', justifyContent: 'center' },
  modeBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: A.muted },
  modeBtnTextActive: { color: '#fff' },
  modeHint: { fontSize: 11, color: A.muted, marginTop: -10, marginBottom: 16, lineHeight: 16 },

  previewBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  previewTitle: { fontSize: 13, fontWeight: '800', color: A.ink, marginBottom: 2 },
  previewSub: { fontSize: 11, color: A.muted, marginBottom: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: A.border },
  previewRowNum: { width: 34, fontSize: 12, fontWeight: '700', color: A.muted },
  previewRowMonth: { flex: 1, fontSize: 12, color: A.ink },
  previewRowAmt: { fontSize: 12, fontWeight: '700', color: A.ink },
});
