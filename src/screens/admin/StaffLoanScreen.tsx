import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { resolveFileUrl } from '../../utils/fileUrl';
import {
  cancelStaffLoan,
  createStaffLoan,
  CreateLoanPayload,
  getStaffLoanEmiGrid,
  getStaffLoanEmployees,
  getStaffLoanGrid,
  LoanSchedulePreviewRow,
  previewStaffLoanSchedule,
  receiveStaffLoanEmi,
  StaffLoanEmiRow,
  StaffLoanEmployee,
  StaffLoanRow,
} from '../../api/adminStaffLoanApi';
import { approveLoanRequest, getLoanRequests, LoanRequestRow, rejectLoanRequest } from '../../api/adminLoanRequestApi';

const A = colors.admin;
const DUE_CSS_COLOR: Record<string, string> = { done: '#15803d', overdue: '#dc2626', today: '#d97706', soon: '#d97706', upcoming: '#6b7280' };
const TERMS_LANG_LABEL: Record<string, string> = { en: 'English', hi: 'Hindi', pa: 'Punjabi' };

export default function StaffLoanScreen({ params }: { params?: { openIssueModal?: boolean; initialTab?: 'loans' | 'emis' | 'requests' } }) {
  const { navigate } = useAdminNav();
  // Arriving from a "New Loan Request" notification tap
  // (navigate('StaffLoans', { initialTab: 'requests' })) lands directly on
  // the Requests tab instead of the default Loans tab — otherwise tapping
  // that notification looked like it did nothing.
  const [tab, setTab] = useState<'loans' | 'emis' | 'requests'>(params?.initialTab || 'loans');
  const [search, setSearch] = useState('');
  const [emiSearch, setEmiSearch] = useState('');
  const [loans, setLoans] = useState<StaffLoanRow[]>([]);
  const [loanCount, setLoanCount] = useState(0);
  const [totalDisbursed, setTotalDisbursed] = useState('0.00');
  const [totalRemaining, setTotalRemaining] = useState('0.00');
  const [emis, setEmis] = useState<StaffLoanEmiRow[]>([]);
  const [emiStats, setEmiStats] = useState({ pendingCount: 0, pendingAmountDisplay: '0.00', collectedCount: 0, collectedAmountDisplay: '0.00', overdueCount: 0, overdueAmountDisplay: '0.00' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Auto-opens when arriving from the Loan Dashboard's "+ Add Loan" entry
  // point (navigate('StaffLoans', { openIssueModal: true })) — otherwise
  // this screen is reached from the sidebar with no params, same as before.
  const [showIssueModal, setShowIssueModal] = useState(!!params?.openIssueModal);
  const [receiveTarget, setReceiveTarget] = useState<StaffLoanEmiRow | null>(null);

  const [requests, setRequests] = useState<LoanRequestRow[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [approveTarget, setApproveTarget] = useState<LoanRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LoanRequestRow | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const loadLoans = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getStaffLoanGrid(term);
      setLoans(res.data.loans);
      setLoanCount(res.data.loanCount);
      setTotalDisbursed(res.data.totalDisbursedDisplay);
      setTotalRemaining(res.data.totalRemainingDisplay);
    } catch {
      Alert.alert('Could not load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmis = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getStaffLoanEmiGrid({ search: term || undefined });
      setEmis(res.data.emis);
      setEmiStats(res.data.stats);
    } catch {
      Alert.alert('Could not load EMIs');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async (status: 'Pending' | 'Approved' | 'Rejected') => {
    setLoading(true);
    try {
      const res = await getLoanRequests(status);
      setRequests(res.data.requests);
      setPendingRequestCount(res.data.pendingCount);
    } catch {
      Alert.alert('Could not load loan requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'loans') loadLoans(search || undefined);
    else if (tab === 'emis') loadEmis(emiSearch || undefined);
    else loadRequests(requestStatusFilter);
  }, [tab, loadLoans, loadEmis, loadRequests, search, emiSearch, requestStatusFilter]);

  const handleCancel = (loan: StaffLoanRow) => {
    Alert.alert('Cancel this loan?', `${loan.loanRef} for ${loan.empName} will be cancelled and its pending EMIs removed. Received EMI history is preserved.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Loan',
        style: 'destructive',
        onPress: async () => {
          setBusyId(loan.staffLoanId);
          try {
            await cancelStaffLoan(loan.staffLoanId);
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

  const handleReceive = async (emi: StaffLoanEmiRow, amount: number, paymentMode: string, remarks: string) => {
    try {
      const res = await receiveStaffLoanEmi(emi.emiScheduleId, { amount, paymentMode, remarks });
      Alert.alert('Received', res.data.message || 'EMI marked as received.');
      setReceiveTarget(null);
      loadEmis(emiSearch || undefined);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    }
  };

  const handleReject = async (request: LoanRequestRow, remarks: string) => {
    try {
      const res = await rejectLoanRequest(request.loanRequestId, remarks);
      Alert.alert('Rejected', res.data.message || 'Loan request rejected.');
      setRejectTarget(null);
      loadRequests(requestStatusFilter);
    } catch (err: any) {
      Alert.alert('Could not reject', err?.response?.data?.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'loans' && styles.tabBtnActive]} onPress={() => setTab('loans')}>
          <Text style={[styles.tabBtnText, tab === 'loans' && styles.tabBtnTextActive]}>Loans ({loanCount})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'emis' && styles.tabBtnActive]} onPress={() => setTab('emis')}>
          <Text style={[styles.tabBtnText, tab === 'emis' && styles.tabBtnTextActive]}>EMIs ({emiStats.pendingCount})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]} onPress={() => setTab('requests')}>
          <Text style={[styles.tabBtnText, tab === 'requests' && styles.tabBtnTextActive]}>Requests ({pendingRequestCount})</Text>
        </Pressable>
      </View>

      {tab === 'loans' ? (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>₹{totalDisbursed}</Text>
              <Text style={styles.kpiLabel}>Active Principal</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#dc2626' }]}>₹{totalRemaining}</Text>
              <Text style={styles.kpiLabel}>Remaining</Text>
            </View>
          </View>

          <View style={styles.topRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search employee or loan ref..."
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
                <Text style={styles.emptyText}>No loans found.</Text>
              ) : (
                loans.map((loan) => (
                  <Pressable key={loan.staffLoanId} style={styles.card} onPress={() => navigate('StaffLoanDetail', { loanId: loan.staffLoanId })}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{loan.empName}</Text>
                        <Text style={styles.sub}>{loan.loanRef} · {loan.deptName || '—'}</Text>
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
                      {loan.receivedEMIs}/{loan.totalEMIs} EMIs · Paid ₹{loan.paidDisplay} · Outstanding ₹{loan.outstandingDisplay}
                    </Text>
                    {(loan.lumpSumDisplay || loan.topUpDisplay) && (
                      <Text style={styles.extraLine}>
                        {loan.lumpSumDisplay ? `${loan.lumpSumCount} lump sum(s) ₹${loan.lumpSumDisplay}` : ''}
                        {loan.lumpSumDisplay && loan.topUpDisplay ? ' · ' : ''}
                        {loan.topUpDisplay ? `${loan.topUpCount} top-up(s) ₹${loan.topUpDisplay}` : ''}
                      </Text>
                    )}
                    {loan.overdueCount > 0 && <Text style={styles.overdueLine}>{loan.overdueCount} overdue EMI(s) · ₹{loan.overdueDisplay}</Text>}

                    {loan.status === 'Active' && (
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={[styles.actionBtn, styles.cancelBtn]}
                          onPress={() => handleCancel(loan)}
                          disabled={busyId === loan.staffLoanId}
                        >
                          {busyId === loan.staffLoanId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.cancelText}>Cancel Loan</Text>}
                        </Pressable>
                        <Pressable style={styles.detailLink} onPress={() => navigate('StaffLoanDetail', { loanId: loan.staffLoanId })}>
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
      ) : tab === 'emis' ? (
        <>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{emiStats.pendingCount}</Text>
              <Text style={styles.kpiLabel}>Pending ₹{emiStats.pendingAmountDisplay}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#15803d' }]}>{emiStats.collectedCount}</Text>
              <Text style={styles.kpiLabel}>Collected ₹{emiStats.collectedAmountDisplay}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{emiStats.overdueCount}</Text>
              <Text style={styles.kpiLabel}>Overdue ₹{emiStats.overdueAmountDisplay}</Text>
            </View>
          </View>

          <View style={styles.topRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search employee or loan ref..."
              placeholderTextColor={A.muted}
              value={emiSearch}
              onChangeText={setEmiSearch}
              onSubmitEditing={() => loadEmis(emiSearch || undefined)}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {emis.length === 0 ? (
                <Text style={styles.emptyText}>No EMIs found.</Text>
              ) : (
                emis.map((emi) => (
                  <View key={emi.emiScheduleId} style={styles.emiRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emiEmp}>{emi.employeeDisplay}</Text>
                      <Text style={styles.emiSub}>{emi.loanRef} · EMI {emi.emiNumber}/{emi.totalEMIs}</Text>
                      <Text style={[styles.emiDue, { color: DUE_CSS_COLOR[emi.dueDateCss] }]}>{emi.dueDateLabel} · {emi.dueDateDisplay}</Text>
                    </View>
                    <View style={styles.emiRight}>
                      <Text style={styles.emiAmt}>₹{emi.emiAmountDisplay}</Text>
                      {emi.status === 'Pending' ? (
                        <Pressable style={styles.receiveBtn} onPress={() => setReceiveTarget(emi)}>
                          <Text style={styles.receiveBtnText}>Receive</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.receivedTag}>Received</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          <View style={styles.tabRow}>
            {(['Pending', 'Approved', 'Rejected'] as const).map((s) => (
              <Pressable key={s} style={[styles.filterChip, requestStatusFilter === s && styles.filterChipActive]} onPress={() => setRequestStatusFilter(s)}>
                <Text style={[styles.filterChipText, requestStatusFilter === s && styles.filterChipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {requests.length === 0 ? (
                <Text style={styles.emptyText}>No {requestStatusFilter.toLowerCase()} loan requests.</Text>
              ) : (
                requests.map((r) => (
                  <View key={r.loanRequestId} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{r.empName}</Text>
                        <Text style={styles.sub}>
                          {r.empCode} · {r.deptName || '—'} · requested {r.requestDateDisplay}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.amount}>₹{r.requestedAmountDisplay}</Text>
                    <Text style={styles.progressText}>
                      {r.requestedEMIs} EMI{r.requestedEMIs === 1 ? '' : 's'} requested · T&C accepted in {TERMS_LANG_LABEL[r.termsLanguage] || r.termsLanguage}
                    </Text>

                    <View style={styles.docsRow}>
                      {r.chequePhotoUrl && (
                        <Pressable onPress={() => setViewerUrl(resolveFileUrl(r.chequePhotoUrl))}>
                          <Text style={styles.docLabel}>Cheque Photo</Text>
                          <Image source={{ uri: resolveFileUrl(r.chequePhotoUrl) || undefined }} style={styles.docThumb} />
                        </Pressable>
                      )}
                      {r.signaturePath && (
                        <Pressable onPress={() => setViewerUrl(resolveFileUrl(r.signaturePath))}>
                          <Text style={styles.docLabel}>Signature</Text>
                          <Image source={{ uri: resolveFileUrl(r.signaturePath) || undefined }} style={[styles.docThumb, styles.docThumbSig]} resizeMode="contain" />
                        </Pressable>
                      )}
                    </View>

                    {r.status === 'Pending' ? (
                      <View style={styles.actionsRow}>
                        <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setRejectTarget(r)}>
                          <Text style={styles.cancelText}>Reject</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => setApproveTarget(r)}>
                          <Text style={styles.approveText}>Approve</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.progressText, r.status === 'Rejected' && { color: '#dc2626' }]}>
                          {r.status} by {r.decidedBy || '—'} on {r.decisionDateDisplay}
                          {r.status === 'Approved' && r.approvedAmount != null ? ` · ₹${r.approvedAmount.toFixed(2)} over ${r.approvedEMIs} EMIs` : ''}
                        </Text>
                        {r.adminRemarks ? <Text style={styles.extraLine}>Remarks: {r.adminRemarks}</Text> : null}
                      </>
                    )}
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

      {receiveTarget && <ReceiveEmiModal emi={receiveTarget} onClose={() => setReceiveTarget(null)} onConfirm={handleReceive} />}

      {approveTarget && (
        <ApproveRequestModal
          request={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={() => {
            setApproveTarget(null);
            loadRequests(requestStatusFilter);
          }}
        />
      )}

      {rejectTarget && <RejectRequestModal request={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={handleReject} />}

      {viewerUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
          <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function IssueLoanModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [employees, setEmployees] = useState<StaffLoanEmployee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<StaffLoanEmployee | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  // Two mutually exclusive ways to size the schedule (explicit admin
  // request for the 'amount' mode) — 'count': type the number of
  // installments directly (existing). 'amount': type a target monthly
  // instalment and let the server derive the count + handle the remainder
  // (see loanAmountScheduleHelper.js).
  const [mode, setMode] = useState<'count' | 'amount'>('count');
  const [totalEMIs, setTotalEMIs] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [firstEMIMonth, setFirstEMIMonth] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [disbursalDate, setDisbursalDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ schedule: LoanSchedulePreviewRow[]; totalEMIs: number; baseEMIDisplay: string; totalAmountDisplay: string } | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    getStaffLoanEmployees().then((res) => setEmployees(res.data.employees)).catch(() => {});
  }, []);

  const filteredEmployees = empSearch.trim()
    ? employees.filter((e) => e.label.toLowerCase().includes(empSearch.trim().toLowerCase()))
    : employees;

  // Live EMI schedule preview — mirrors the .NET Issue Loan page's inline preview,
  // computed via the exact same backend math used at actual creation time so the two never disagree.
  useEffect(() => {
    const amt = Number(loanAmount);
    const emis = Number(totalEMIs);
    const monthly = Number(monthlyAmount);
    const day = Number(dueDay);
    const sizingReady = mode === 'count' ? !!emis && emis >= 1 : !!monthly && monthly > 0;
    if (!amt || amt <= 0 || !sizingReady || !firstEMIMonth || !day || day < 1 || day > 28) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewStaffLoanSchedule({
        employeeId: 0,
        loanAmount: amt,
        ...(mode === 'count' ? { totalEMIs: emis } : { monthlyAmount: monthly }),
        dueDay: day,
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
  }, [loanAmount, mode, totalEMIs, monthlyAmount, dueDay, firstEMIMonth]);

  const save = async () => {
    if (!selectedEmp) return Alert.alert('Please select an employee.');
    const payload: CreateLoanPayload = {
      employeeId: selectedEmp.employeeId,
      loanAmount: Number(loanAmount),
      ...(mode === 'count' ? { totalEMIs: Number(totalEMIs) } : { monthlyAmount: Number(monthlyAmount) }),
      dueDay: Number(dueDay),
      firstEMIMonth,
      disbursalDate,
      description,
    };
    setSaving(true);
    try {
      await createStaffLoan(payload);
      Alert.alert('Loan Issued', 'EMI schedule generated successfully.');
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not issue loan', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Issue Brand Loan</Text>

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

            <TextField label="Loan Amount *" value={loanAmount} onChangeText={setLoanAmount} keyboardType="decimal-pad" />

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
            <DateField label="First EMI Month *" granularity="month" value={firstEMIMonth} onChange={setFirstEMIMonth} placeholder="Select month" />
            <TextField label="Due Day of Month (1-28) *" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
            <DateField label="Disbursal Date" granularity="day" value={disbursalDate} onChange={setDisbursalDate} />
            <TextField label="Purpose / Description" value={description} onChangeText={setDescription} multiline numberOfLines={2} />

            {previewLoading ? (
              <ActivityIndicator size="small" color={A.primary} style={{ marginBottom: 16 }} />
            ) : preview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>EMI Schedule Preview</Text>
                <Text style={styles.previewSub}>
                  {preview.totalEMIs} EMI{preview.totalEMIs === 1 ? '' : 's'}
                  {mode === 'count' ? ` · ₹${preview.baseEMIDisplay} each (last adjusted)` : ''} · Total ₹{preview.totalAmountDisplay}
                </Text>
                {preview.schedule.map((row) => (
                  <View key={row.emiNumber} style={styles.previewRow}>
                    <Text style={styles.previewRowNum}>#{row.emiNumber}</Text>
                    <Text style={styles.previewRowMonth}>{row.dueDateDisplay}</Text>
                    <Text style={styles.previewRowAmt}>₹{row.amountDisplay}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Issue Loan" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ReceiveEmiModal({
  emi,
  onClose,
  onConfirm,
}: {
  emi: StaffLoanEmiRow;
  onClose: () => void;
  onConfirm: (emi: StaffLoanEmiRow, amount: number, paymentMode: string, remarks: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(emi.emiAmountDisplay);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid received amount.');
    setSaving(true);
    try {
      await onConfirm(emi, amt, paymentMode, remarks);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Receive EMI</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLine}>{emi.employeeDisplay}</Text>
            <Text style={styles.summaryLine}>{emi.loanRef} · EMI {emi.emiNumber} of {emi.totalEMIs}</Text>
            <Text style={styles.summaryLine}>Due {emi.dueDateDisplay} · ₹{emi.emiAmountDisplay}</Text>
          </View>

          <TextField label="Received Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Text style={styles.label}>Payment Mode</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={paymentMode} onValueChange={setPaymentMode}>
              <Picker.Item label="Cash" value="Cash" />
              <Picker.Item label="Online Transfer" value="Online Transfer" />
              <Picker.Item label="Credit Note" value="Credit Note" />
              <Picker.Item label="Debit Note" value="Debit Note" />
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

/**
 * Approves an employee-submitted loan request — dueDay/firstEMIMonth are
 * always admin-supplied (mirrors IssueLoanModal's fields for those), while
 * amount/EMIs default to what the employee requested and can be overridden.
 * Reuses adminLoanRequestService.approveRequest server-side, which itself
 * calls createStaffLoan, so the resulting EMI schedule is generated by the
 * exact same logic as issuing a loan directly.
 */
function ApproveRequestModal({ request, onClose, onApproved }: { request: LoanRequestRow; onClose: () => void; onApproved: () => void }) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(String(request.requestedAmount));
  const [emis, setEmis] = useState(String(request.requestedEMIs));
  const [firstEMIMonth, setFirstEMIMonth] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [disbursalDate, setDisbursalDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!firstEMIMonth) return Alert.alert('Select the first EMI month.');
    const day = Number(dueDay);
    if (!day || day < 1 || day > 28) return Alert.alert('Due Day must be between 1 and 28.');
    setSaving(true);
    try {
      const res = await approveLoanRequest(request.loanRequestId, {
        amount: Number(amount),
        emis: Number(emis),
        dueDay: day,
        firstEMIMonth,
        disbursalDate,
        description,
        remarks,
      });
      Alert.alert('Approved', res.data.message || 'Loan request approved.');
      onApproved();
    } catch (err: any) {
      Alert.alert('Could not approve', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>Approve Loan Request</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>{request.empName}</Text>
              <Text style={styles.summaryLine}>
                Requested ₹{request.requestedAmountDisplay} over {request.requestedEMIs} EMI{request.requestedEMIs === 1 ? '' : 's'}
              </Text>
            </View>

            <TextField label="Loan Amount *" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TextField label="Number of EMIs *" value={emis} onChangeText={setEmis} keyboardType="number-pad" />
            <DateField label="First EMI Month *" granularity="month" value={firstEMIMonth} onChange={setFirstEMIMonth} placeholder="Select month" />
            <TextField label="Due Day of Month (1-28) *" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
            <DateField label="Disbursal Date" granularity="day" value={disbursalDate} onChange={setDisbursalDate} />
            <TextField label="Purpose / Description" value={description} onChangeText={setDescription} multiline numberOfLines={2} />
            <TextField label="Remarks (optional)" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Approve & Issue Loan" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RejectRequestModal({
  request,
  onClose,
  onConfirm,
}: {
  request: LoanRequestRow;
  onClose: () => void;
  onConfirm: (request: LoanRequestRow, remarks: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!remarks.trim()) return Alert.alert('Enter a reason for rejecting this request.');
    setSaving(true);
    try {
      await onConfirm(request, remarks.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Reject Loan Request</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLine}>{request.empName}</Text>
            <Text style={styles.summaryLine}>₹{request.requestedAmountDisplay} · {request.requestedEMIs} EMIs</Text>
          </View>
          <TextField label="Reason *" value={remarks} onChangeText={setRemarks} multiline numberOfLines={3} placeholder="Why is this request being rejected?" />
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Reject" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
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

  filterChip: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  filterChipActive: { backgroundColor: A.primary, borderColor: A.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: A.muted },
  filterChipTextActive: { color: '#fff' },

  docsRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 4 },
  docLabel: { fontSize: 11, color: A.muted, fontWeight: '600', marginBottom: 4 },
  docThumb: { width: 100, height: 70, borderRadius: radius.sm, backgroundColor: A.surfaceRaised, borderWidth: 1, borderColor: A.border },
  docThumbSig: { backgroundColor: '#fff' },
  approveBtn: { backgroundColor: A.primary },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },

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
  extraLine: { fontSize: 11, color: A.muted, marginTop: 4 },
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
  receiveBtn: { backgroundColor: A.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  receiveBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  receivedTag: { fontSize: 11, color: '#15803d', fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  empResultsBox: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginTop: -8, marginBottom: 16, backgroundColor: A.surface },
  empResultRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  empResultText: { fontSize: 13, color: A.ink },
  empResultEmpty: { padding: 10, fontSize: 12, color: A.muted },
  summaryBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  summaryLine: { fontSize: 12, color: A.ink, marginBottom: 2 },
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
