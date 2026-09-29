import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  confirmPayrollLumpSum,
  confirmPayrollReschedule,
  confirmPayrollTopUp,
  editPayrollLoanSchedule,
  getPayrollLoanDetail,
  getPayrollLumpSumInfo,
  getPayrollRescheduleInfo,
  getPayrollTopUpInfo,
  PayrollLoanDetailResponse,
  PayrollLoanReschedInfo,
  skipPayrollLoanSchedule,
} from '../../api/adminPayrollLoanApi';

const A = colors.admin;

export default function PayrollLoanDetailScreen({ params }: { params?: { loanId?: number } }) {
  const loanId = params?.loanId;
  const [detail, setDetail] = useState<PayrollLoanDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'lumpsum' | 'topup' | 'reschedule' | null>(null);
  const [editTarget, setEditTarget] = useState<PayrollLoanDetailResponse['schedules'][number] | null>(null);
  const [skippingId, setSkippingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const res = await getPayrollLoanDetail(loanId);
      setDetail(res.data);
    } catch {
      Alert.alert('Could not load advance details');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSkip = (s: PayrollLoanDetailResponse['schedules'][number]) => {
    Alert.alert(
      `Skip ${s.salaryMonthDisplay} deduction?`,
      `EMI ${s.emiNumber} of ${s.totalEMIs} (₹${s.deductionAmountDisplay}) will be moved to the month right after this advance's current last EMI. Nothing is waived — the advance just finishes one month later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip This Month',
          onPress: async () => {
            setSkippingId(s.scheduleId);
            try {
              const res = await skipPayrollLoanSchedule(s.scheduleId);
              Alert.alert('EMI Skipped', res.data.message || 'Moved to the end of the deduction schedule.');
              await load();
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

  if (!loanId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No advance selected.</Text>
      </View>
    );
  }

  if (loading || !detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  const { loan, schedules, lumpSums, topUps } = detail;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.empName}>{loan.empName} <Text style={styles.empCode}>· {loan.empCode}</Text></Text>
          <Text style={styles.loanRef}>{loan.loanRef} · {loan.status}</Text>
          {!!loan.description && <Text style={styles.desc}>{loan.description}</Text>}

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiVal}>₹{loan.principalDisplay}</Text>
              <Text style={styles.kpiLbl}>Principal</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#15803d' }]}>₹{loan.paidDisplay}</Text>
              <Text style={styles.kpiLbl}>Paid</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#dc2626' }]}>₹{loan.remainingDisplay}</Text>
              <Text style={styles.kpiLbl}>Remaining</Text>
            </View>
          </View>
          {loan.overdueCount > 0 && <Text style={styles.overdueLine}>{loan.overdueCount} EMI(s) overdue</Text>}
        </View>

        {loan.status === 'Active' && (
          <View style={styles.actionRow}>
            <Pressable style={styles.actionChip} onPress={() => setModal('lumpsum')}>
              <Text style={styles.actionChipText}>Lump Sum</Text>
            </Pressable>
            <Pressable style={styles.actionChip} onPress={() => setModal('topup')}>
              <Text style={styles.actionChipText}>Top-Up</Text>
            </Pressable>
            <Pressable style={styles.actionChip} onPress={() => setModal('reschedule')}>
              <Text style={styles.actionChipText}>Reschedule</Text>
            </Pressable>
          </View>
        )}

        {(lumpSums.length > 0 || topUps.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adjustments</Text>
            {lumpSums.map((p, i) => (
              <View key={`ls-${i}`} style={styles.adjRow}>
                <Text style={styles.adjBadgeLump}>Lump Sum</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adjAmt}>₹{p.amountPaidDisplay}</Text>
                  <Text style={styles.adjMeta}>{p.paymentDateDisplay} · {p.paymentMode || '—'} · {p.reschedulingOption}{p.remarks ? ` · ${p.remarks}` : ''}</Text>
                </View>
              </View>
            ))}
            {topUps.map((t, i) => (
              <View key={`tu-${i}`} style={styles.adjRow}>
                <Text style={styles.adjBadgeTopUp}>Top-Up</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adjAmt}>₹{t.amountGivenDisplay}</Text>
                  <Text style={styles.adjMeta}>{t.disbursalDateDisplay} · {t.paymentMode || '—'} · {t.reschedulingOption}{t.remarks ? ` · ${t.remarks}` : ''}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deduction Schedule ({schedules.length})</Text>
          {schedules.map((s) => (
            <Pressable
              key={s.scheduleId}
              style={[styles.emiRow, s.isOverdue && styles.emiRowOverdue]}
              onPress={() => (s.status === 'Pending' && !s.isLocked ? setEditTarget(s) : undefined)}
            >
              <View style={styles.emiNumBox}>
                <Text style={styles.emiNum}>{s.emiNumber}</Text>
                <Text style={styles.emiOf}>of {s.totalEMIs}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emiAmt}>₹{s.deductionAmountDisplay}</Text>
                <Text style={styles.emiDue}>{s.salaryMonthDisplay} Payroll</Text>
                {s.status === 'Deducted' ? (
                  <Text style={styles.emiRecv}>Deducted{s.deductedDateDisplay ? ` on ${s.deductedDateDisplay}` : ''}</Text>
                ) : s.isLocked ? (
                  <Text style={styles.emiLocked}>Locked by payroll run</Text>
                ) : (
                  <Text style={s.isOverdue ? styles.emiOverdueText : styles.emiPendingText}>{s.isOverdue ? 'Overdue — tap to edit' : 'Pending — tap to edit'}</Text>
                )}
                {!!s.remarks && <Text style={styles.emiRemarks}>{s.remarks}</Text>}
              </View>
              {s.status === 'Pending' && !s.isLocked && (
                <Pressable
                  style={styles.skipBtn}
                  disabled={skippingId === s.scheduleId}
                  onPress={() => handleSkip(s)}
                  hitSlop={6}
                >
                  {skippingId === s.scheduleId ? <ActivityIndicator size="small" color="#7c3aed" /> : <Text style={styles.skipBtnText}>Skip →</Text>}
                </Pressable>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {modal === 'lumpsum' && <LumpSumModal loanId={loanId} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === 'topup' && <TopUpModal loanId={loanId} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === 'reschedule' && <RescheduleModal loanId={loanId} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {editTarget && (
        <EditScheduleModal
          schedule={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}
    </View>
  );
}

function EditScheduleModal({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: PayrollLoanDetailResponse['schedules'][number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(schedule.deductionAmountDisplay);
  const [salaryMonth, setSalaryMonth] = useState(schedule.salaryMonth.slice(0, 7));
  const [remarks, setRemarks] = useState(schedule.remarks || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid deduction amount.');
    setSaving(true);
    try {
      await editPayrollLoanSchedule(schedule.scheduleId, { deductionAmount: amt, salaryMonth, remarks });
      Alert.alert('Saved', 'EMI entry updated successfully.');
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
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Edit EMI Entry</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLine}>EMI {schedule.emiNumber} of {schedule.totalEMIs}</Text>
          </View>
          <TextField label="Deduction Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <DateField label="Salary Month" granularity="month" value={salaryMonth} onChange={setSalaryMonth} placeholder="Select month" />
          <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LumpSumModal({ loanId, onClose, onSaved }: { loanId: number; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<PayrollLoanReschedInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [option, setOption] = useState<'A' | 'B'>('A');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getPayrollLumpSumInfo(loanId)
      .then((res) => setInfo(res.data))
      .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load advance info.'));
  }, [loanId]);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid lump sum amount greater than zero.');
    setSaving(true);
    try {
      const res = await confirmPayrollLumpSum(loanId, { amount: amt, paymentMode, remarks, option });
      Alert.alert(res.data.settled ? 'Advance Settled' : 'Saved', res.data.message);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Record Lump Sum Payment</Text>
            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : !info ? (
              <ActivityIndicator size="small" color={A.primary} />
            ) : (
              <>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLine}>{info.empName} · {info.loanRef}</Text>
                  <Text style={styles.summaryLine}>Outstanding: ₹{info.outstandingDisplay} · {info.pendingCount} unlocked pending EMIs</Text>
                </View>
                <TextField label="Lump Sum Amount *" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                <Text style={styles.label}>Payment Mode</Text>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={paymentMode} onValueChange={setPaymentMode}>
                    <Picker.Item label="Cash" value="Cash" />
                    <Picker.Item label="Online Transfer" value="Online Transfer" />
                    <Picker.Item label="Credit Note" value="Credit Note" />
                    <Picker.Item label="Debit Note" value="Debit Note" />
                  </Picker>
                </View>
                <Text style={styles.label}>Rescheduling Option</Text>
                <View style={styles.optionRow}>
                  <Pressable style={[styles.optionChip, option === 'A' && styles.optionChipActive]} onPress={() => setOption('A')}>
                    <Text style={[styles.optionChipText, option === 'A' && styles.optionChipTextActive]}>Reduce Deduction Amount</Text>
                  </Pressable>
                  <Pressable style={[styles.optionChip, option === 'B' && styles.optionChipActive]} onPress={() => setOption('B')}>
                    <Text style={[styles.optionChipText, option === 'B' && styles.optionChipTextActive]}>Fewer Payroll Months</Text>
                  </Pressable>
                </View>
                <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Confirm" onPress={save} loading={saving} disabled={!info} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TopUpModal({ loanId, onClose, onSaved }: { loanId: number; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<PayrollLoanReschedInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [option, setOption] = useState<'A' | 'B'>('A');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getPayrollTopUpInfo(loanId)
      .then((res) => setInfo(res.data))
      .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load advance info.'));
  }, [loanId]);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid top-up amount greater than zero.');
    setSaving(true);
    try {
      const res = await confirmPayrollTopUp(loanId, { amount: amt, paymentMode, remarks, option });
      Alert.alert('Saved', res.data.message);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Record Top-Up</Text>
            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : !info ? (
              <ActivityIndicator size="small" color={A.primary} />
            ) : (
              <>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLine}>{info.empName} · {info.loanRef}</Text>
                  <Text style={styles.summaryLine}>Outstanding: ₹{info.outstandingDisplay} · {info.pendingCount} unlocked pending EMIs</Text>
                </View>
                <TextField label="Top-Up Amount *" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                <Text style={styles.label}>Payment Mode</Text>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={paymentMode} onValueChange={setPaymentMode}>
                    <Picker.Item label="Cash" value="Cash" />
                    <Picker.Item label="Online Transfer" value="Online Transfer" />
                    <Picker.Item label="Credit Note" value="Credit Note" />
                    <Picker.Item label="Debit Note" value="Debit Note" />
                  </Picker>
                </View>
                <Text style={styles.label}>Rescheduling Option</Text>
                <View style={styles.optionRow}>
                  <Pressable style={[styles.optionChip, option === 'A' && styles.optionChipActive]} onPress={() => setOption('A')}>
                    <Text style={[styles.optionChipText, option === 'A' && styles.optionChipTextActive]}>Increase Deduction</Text>
                  </Pressable>
                  <Pressable style={[styles.optionChip, option === 'B' && styles.optionChipActive]} onPress={() => setOption('B')}>
                    <Text style={[styles.optionChipText, option === 'B' && styles.optionChipTextActive]}>Add More Months</Text>
                  </Pressable>
                </View>
                <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Confirm" onPress={save} loading={saving} disabled={!info} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RescheduleModal({ loanId, onClose, onSaved }: { loanId: number; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<PayrollLoanReschedInfo | null>(null);
  const [newEMIAmount, setNewEMIAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getPayrollRescheduleInfo(loanId)
      .then((res) => setInfo(res.data))
      .catch((err) => setLoadError(err?.response?.data?.message || 'Could not load advance info.'));
  }, [loanId]);

  const save = async () => {
    const amt = Number(newEMIAmount);
    if (!amt || amt <= 0) return Alert.alert('Please enter a valid new deduction amount greater than zero.');
    setSaving(true);
    try {
      const res = await confirmPayrollReschedule(loanId, { newEMIAmount: amt, remarks });
      Alert.alert('Rescheduled', res.data.message);
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Reschedule Deductions</Text>
            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : !info ? (
              <ActivityIndicator size="small" color={A.primary} />
            ) : (
              <>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLine}>{info.empName} · {info.loanRef}</Text>
                  <Text style={styles.summaryLine}>Current EMI: ₹{info.currentEMIDisplay} · Outstanding: ₹{info.outstandingDisplay} · {info.pendingCount} unlocked pending EMIs</Text>
                </View>
                <TextField label="New Deduction Amount *" value={newEMIAmount} onChangeText={setNewEMIAmount} keyboardType="decimal-pad" />
                <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />
              </>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Confirm" onPress={save} loading={saving} disabled={!info} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2) },
  emptyText: { color: A.muted, fontSize: 13 },

  headerCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16, ...shadow.card },
  empName: { fontSize: 16, fontWeight: '800', color: A.ink },
  empCode: { fontWeight: '500', color: A.muted },
  loanRef: { fontSize: 12, color: A.muted, marginTop: 2 },
  desc: { fontSize: 12, color: A.muted, marginTop: 6, fontStyle: 'italic' },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  kpiBox: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 15, fontWeight: '800', color: A.ink },
  kpiLbl: { fontSize: 10, color: A.muted, marginTop: 2, fontWeight: '600' },
  overdueLine: { fontSize: 12, color: '#dc2626', fontWeight: '700', marginTop: 10, textAlign: 'center' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionChip: { flex: 1, height: 40, borderRadius: radius.sm, backgroundColor: A.surface, borderWidth: 1.5, borderColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  actionChipText: { color: A.primary, fontWeight: '700', fontSize: 12 },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: A.ink, marginBottom: 10 },

  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: A.surface, borderRadius: radius.sm, padding: 10, marginBottom: 8, ...shadow.card },
  adjBadgeLump: { fontSize: 10, fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adjBadgeTopUp: { fontSize: 10, fontWeight: '700', color: '#0891b2', backgroundColor: '#cffafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adjAmt: { fontSize: 13, fontWeight: '800', color: A.ink },
  adjMeta: { fontSize: 11, color: A.muted, marginTop: 2 },

  emiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: A.surface, borderRadius: radius.sm, padding: 10, marginBottom: 8, ...shadow.card },
  emiRowOverdue: { borderWidth: 1, borderColor: '#fca5a5' },
  emiNumBox: { alignItems: 'center', justifyContent: 'center', width: 40 },
  emiNum: { fontSize: 16, fontWeight: '800', color: A.primary },
  emiOf: { fontSize: 9, color: A.muted },
  emiAmt: { fontSize: 13, fontWeight: '800', color: A.ink },
  emiDue: { fontSize: 11, color: A.muted, marginTop: 2 },
  emiRecv: { fontSize: 11, color: '#15803d', marginTop: 2, fontWeight: '600' },
  emiLocked: { fontSize: 11, color: '#92400e', marginTop: 2, fontWeight: '600' },
  emiPendingText: { fontSize: 11, color: '#d97706', marginTop: 2, fontWeight: '600' },
  emiOverdueText: { fontSize: 11, color: '#dc2626', marginTop: 2, fontWeight: '700' },
  emiRemarks: { fontSize: 10, color: A.muted, marginTop: 3, fontStyle: 'italic' },
  skipBtn: { minWidth: 58, height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
  skipBtnText: { fontSize: 11, fontWeight: '700', color: '#7c3aed' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  summaryBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  summaryLine: { fontSize: 12, color: A.ink, marginBottom: 3 },
  optionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  optionChip: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, borderColor: A.border, alignItems: 'center' },
  optionChipActive: { backgroundColor: A.primary + '1a', borderColor: A.primary },
  optionChipText: { fontSize: 11, fontWeight: '700', color: A.muted, textAlign: 'center' },
  optionChipTextActive: { color: A.primary },
  errorText: { color: '#b91c1c', fontSize: 13, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
