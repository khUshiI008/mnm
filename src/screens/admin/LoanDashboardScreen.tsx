import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import {
  getLoanDashboardGrid,
  getLoanDashboardKpis,
  LoanEmiRow,
  LoanKpis,
  notifyAllOverdueEmployees,
  notifyOverdueEmi,
  receiveEmiPayment,
  skipEmi,
} from '../../api/adminLoanDashboardApi';

const A = colors.admin;

/**
 * One silent retry after a short delay — the shared DB connection (see
 * backend's config/db.js) has a known, pre-existing flaky-network
 * characteristic where a pooled connection occasionally comes back
 * ETIMEDOUT/ECONNRESET on its first reuse after sitting idle; the backend's
 * own Sequelize `retry` config already re-runs the query on a fresh
 * connection when that happens, but a slow/failed attempt here still costs
 * this screen a full round trip first. This mirrors that same "just try
 * again once" behavior client-side so a single blip doesn't surface as
 * "Could not load receivables" for what's normally a fast, small query.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 700): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return withRetry(fn, retries - 1, delayMs);
  }
}

const BUCKETS: { key: keyof LoanKpis; label: string; tint: string }[] = [
  { key: 'dueThisMonth', label: 'Due This Month', tint: '#2563eb' },
  // Deliberately amber, not red — the app now nudges the affected employees
  // directly (OverdueLoanAlert.tsx), so this card is just a heads-up for
  // admin ("these are the ones to follow up on"), not an urgent alarm.
  { key: 'overdue', label: 'Overdue', tint: colors.warning },
];

export default function LoanDashboardScreen() {
  const { navigate } = useAdminNav();
  const [kpis, setKpis] = useState<LoanKpis | null>(null);
  // Defaults to 'overdue' (rather than nothing selected) — explicit admin
  // request: overdue is what needs following up on, so it should be visible
  // the moment this screen opens, not after an extra tap.
  const [bucket, setBucket] = useState<string | null>('overdue');
  const [search, setSearch] = useState('');
  const [gridTitle, setGridTitle] = useState('');
  const [rows, setRows] = useState<LoanEmiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<LoanEmiRow | null>(null);
  const [skipTarget, setSkipTarget] = useState<LoanEmiRow | null>(null);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [notifyingAll, setNotifyingAll] = useState(false);

  const loadKpis = useCallback(async () => {
    try {
      const res = await withRetry(() => getLoanDashboardKpis());
      setKpis(res.data);
    } catch {
      Alert.alert('Could not load loan dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Parallel, not sequential — same reasoning as refresh() below, and
    // doubly relevant here since this is the very first thing the screen
    // does, right when "Overdue" now opens by default.
    loadKpis();
    openBucket('overdue');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openBucket = async (key: string, term?: string) => {
    setBucket(key);
    setGridLoading(true);
    try {
      const res = await withRetry(() => getLoanDashboardGrid({ bucket: key, search: term || undefined, page: 0, pageSize: 50 }));
      setRows(res.data.rows);
      setTotal(res.data.total);
      setGridTitle(res.data.gridTitle);
    } catch {
      Alert.alert('Could not load receivables');
    } finally {
      setGridLoading(false);
    }
  };

  // Switching buckets resets the search box — a term typed for "Overdue" isn't
  // necessarily meaningful once you're looking at a different bucket.
  const selectBucket = (key: string) => {
    setSearch('');
    openBucket(key);
  };

  const refresh = async () => {
    // Parallel, not sequential — these two are independent requests, and
    // running them one after another was doubling the wait (and doubling
    // the odds of hitting the flaky DB-network blips db.js already documents)
    // every time this fired after a Receive/Skip/Notify action.
    await Promise.all([loadKpis(), bucket ? openBucket(bucket, search) : Promise.resolve()]);
  };

  const handleNotifyOne = (row: LoanEmiRow) => {
    Alert.alert('Send reminder?', `Send an overdue-payment reminder push to ${row.empName} right now.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setNotifyingId(row.emiScheduleId);
          try {
            const res = await notifyOverdueEmi(row.emiScheduleId);
            Alert.alert('Sent', res.data.message);
          } catch (err: any) {
            Alert.alert('Could not send', err?.response?.data?.message || 'Please try again.');
          } finally {
            setNotifyingId(null);
          }
        },
      },
    ]);
  };

  const handleNotifyAll = () => {
    Alert.alert('Send reminder to everyone?', `Every employee with an overdue EMI (${total} total) will get a push right now asking them to clear it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send to All',
        onPress: async () => {
          setNotifyingAll(true);
          try {
            const res = await notifyAllOverdueEmployees();
            Alert.alert('Sent', res.data.message);
          } catch (err: any) {
            Alert.alert('Could not send', err?.response?.data?.message || 'Please try again.');
          } finally {
            setNotifyingAll(false);
          }
        },
      },
    ]);
  };

  const handleAddLoan = () => {
    Alert.alert('Add Loan', 'Which kind of loan is this?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Brand Staff Loan', onPress: () => navigate('StaffLoans', { openIssueModal: true }) },
      { text: 'Inhouse (Payroll)', onPress: () => navigate('PayrollLoans', { openIssueModal: true }) },
    ]);
  };

  if (loading || !kpis) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.addLoanBtn} onPress={handleAddLoan}>
          <Text style={styles.addLoanBtnText}>+ Add Loan</Text>
        </Pressable>
        <View style={styles.kpiGrid}>
          {BUCKETS.map((b) => {
            const data = kpis[b.key];
            const active = bucket === b.key;
            return (
              <Pressable key={b.key} style={[styles.kpiCard, active && { borderColor: b.tint, borderWidth: 2 }]} onPress={() => selectBucket(b.key)}>
                <Text style={[styles.kpiValue, { color: b.tint }]}>{data.count}</Text>
                <Text style={styles.kpiLabel}>{b.label}</Text>
                <Text style={styles.kpiAmount}>₹{data.amount.toFixed(0)}</Text>
              </Pressable>
            );
          })}
        </View>

        {bucket && (
          <>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionHeading}>
                {gridTitle} ({total})
              </Text>
              {bucket === 'overdue' && rows.length > 0 && (
                <Pressable style={styles.notifyAllBtn} onPress={handleNotifyAll} disabled={notifyingAll}>
                  {notifyingAll ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.notifyAllBtnText}>🔔 Notify All</Text>}
                </Pressable>
              )}
            </View>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search employee, code, or loan ref..."
                placeholderTextColor={A.muted}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => openBucket(bucket, search)}
                returnKeyType="search"
              />
            </View>
            {gridLoading ? (
              <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
            ) : rows.length === 0 ? (
              <Text style={styles.emptyText}>Nothing here.</Text>
            ) : (
              rows.map((row) => (
                <View key={`${row.loanType}-${row.emiScheduleId}`} style={styles.row}>
                  <Pressable
                    style={{ flex: 1 }}
                    disabled={!row.staffLoanId}
                    onPress={() =>
                      navigate(row.loanType === 'payroll' ? 'PayrollLoanDetail' : 'StaffLoanDetail', {
                        loanId: row.staffLoanId,
                        title: `${row.empName}'s Loan`,
                      })
                    }
                  >
                    <View style={styles.rowNameLine}>
                      <Text style={styles.rowName}>
                        {row.empName} <Text style={styles.rowCode}>· {row.empCode}</Text>
                      </Text>
                      <View style={[styles.typeBadge, row.loanType === 'payroll' && styles.typeBadgePayroll]}>
                        <Text style={[styles.typeBadgeText, row.loanType === 'payroll' && styles.typeBadgeTextPayroll]}>
                          {row.loanType === 'payroll' ? 'Inhouse' : 'Brand'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowSub}>
                      {row.loanRef} · EMI {row.emiNumber}/{row.totalEMIs} · Due {row.dueDateDisplay}
                    </Text>
                  </Pressable>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowAmount}>₹{row.emiAmountDisplay}</Text>
                    {row.loanType === 'staff' ? (
                      <View style={styles.rowActions}>
                        {bucket === 'overdue' && (
                          <Pressable style={styles.notifyBtn} onPress={() => handleNotifyOne(row)} disabled={notifyingId === row.emiScheduleId}>
                            {notifyingId === row.emiScheduleId ? (
                              <ActivityIndicator size="small" color={A.primary} />
                            ) : (
                              <Text style={styles.notifyBtnText}>🔔</Text>
                            )}
                          </Pressable>
                        )}
                        <Pressable style={styles.skipBtn} onPress={() => setSkipTarget(row)}>
                          <Text style={styles.skipBtnText}>Skip</Text>
                        </Pressable>
                        <Pressable style={styles.receiveBtn} onPress={() => setReceiveTarget(row)}>
                          <Text style={styles.receiveBtnText}>Receive</Text>
                        </Pressable>
                      </View>
                    ) : (
                      // Payroll (inhouse) installments are deducted automatically by
                      // the payroll engine, not manually confirmed by admin here.
                      <Text style={styles.payrollHint}>Auto-deducted via payroll</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}
        {!bucket && <Text style={styles.promptText}>Tap a card above to view its receivables.</Text>}
      </ScrollView>

      {receiveTarget && (
        <ReceiveModal
          row={receiveTarget}
          onClose={() => setReceiveTarget(null)}
          onSaved={() => {
            setReceiveTarget(null);
            refresh();
          }}
        />
      )}

      {skipTarget && (
        <SkipModal
          row={skipTarget}
          onClose={() => setSkipTarget(null)}
          onSaved={() => {
            setSkipTarget(null);
            refresh();
          }}
        />
      )}
    </View>
  );
}

function ReceiveModal({ row, onClose, onSaved }: { row: LoanEmiRow; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(row.emiAmountDisplay);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Received amount must be greater than zero.');
    setSaving(true);
    try {
      const res = await receiveEmiPayment(row.emiScheduleId, { amount: amt, paymentMode, remarks });
      const title = res.data.loanCompleted ? 'Loan Completed' : res.data.partial ? 'Partial Payment Received' : 'Received';
      Alert.alert(title, res.data.message);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Receive Payment</Text>
          <View style={styles.summaryBox}>
            <SummaryRow label="Employee" value={`${row.empName} (${row.empCode})`} />
            <SummaryRow label="Loan Ref" value={row.loanRef} />
            <SummaryRow label="EMI" value={`${row.emiNumber} of ${row.totalEMIs}`} />
            <SummaryRow label="Due Date" value={row.dueDateDisplay} />
            <SummaryRow label="EMI Amount" value={`₹${row.emiAmountDisplay}`} />
          </View>

          <TextField label="Received Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Text style={styles.label}>Payment Mode</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={paymentMode} onValueChange={setPaymentMode}>
              <Picker.Item label="Cash" value="Cash" />
              <Picker.Item label="Bank" value="Bank" />
              <Picker.Item label="UPI" value="UPI" />
            </Picker>
          </View>
          <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Confirm Receipt" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SkipModal({ row, onClose, onSaved }: { row: LoanEmiRow; onClose: () => void; onSaved: () => void }) {
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await skipEmi(row.emiScheduleId, { remarks });
      Alert.alert('Skipped', res.data.message);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not skip', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Skip EMI</Text>
          <View style={styles.summaryBox}>
            <SummaryRow label="Employee" value={`${row.empName} (${row.empCode})`} />
            <SummaryRow label="Loan Ref" value={row.loanRef} />
            <SummaryRow label="EMI" value={`${row.emiNumber} of ${row.totalEMIs}`} />
            <SummaryRow label="Due Date" value={row.dueDateDisplay} />
            <SummaryRow label="EMI Amount" value={`₹${row.emiAmountDisplay}`} />
          </View>

          <Text style={styles.skipNote}>This EMI will be deferred to the end of the schedule with a 10% surcharge on the next installment.</Text>

          <TextField label="Remarks (optional)" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Confirm Skip" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  loader: { marginTop: spacing(3) },

  addLoanBtn: { alignSelf: 'flex-start', backgroundColor: A.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, marginBottom: spacing(1.5) },
  addLoanBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing(2) },
  kpiCard: { width: '47%', backgroundColor: A.surface, borderRadius: radius.md, padding: 14, ...shadow.card },
  kpiValue: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { fontSize: 12, color: A.muted, fontWeight: '600', marginTop: 2 },
  kpiAmount: { fontSize: 13, fontWeight: '700', color: A.ink, marginTop: 4 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: A.ink },
  searchRow: { flexDirection: 'row', marginBottom: spacing(1.5) },
  searchInput: { flex: 1, height: 42, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  notifyAllBtn: { backgroundColor: colors.warning, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: 96, alignItems: 'center' },
  notifyAllBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  notifyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  notifyBtnText: { fontSize: 14 },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(2) },
  promptText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 13, fontWeight: '800', color: A.ink },
  rowCode: { fontWeight: '500', color: A.muted },
  rowSub: { fontSize: 12, color: A.muted, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowAmount: { fontSize: 14, fontWeight: '800', color: A.ink },
  rowActions: { flexDirection: 'row', gap: 6 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: A.primary + '1f' },
  typeBadgePayroll: { backgroundColor: '#e0f2fe' },
  typeBadgeText: { fontSize: 9.5, fontWeight: '800', color: A.primary },
  typeBadgeTextPayroll: { color: '#0369a1' },
  payrollHint: { fontSize: 10, color: A.muted, fontStyle: 'italic', maxWidth: 110, textAlign: 'right' },
  receiveBtn: { backgroundColor: A.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  receiveBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  skipBtn: { backgroundColor: A.surfaceRaised, borderWidth: 1, borderColor: A.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  skipBtnText: { color: A.ink, fontSize: 11, fontWeight: '700' },
  skipNote: { fontSize: 11, color: A.muted, marginBottom: 12, lineHeight: 16 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  modalBox: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  summaryBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 11, color: A.muted },
  summaryValue: { fontSize: 12, fontWeight: '700', color: A.ink },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
