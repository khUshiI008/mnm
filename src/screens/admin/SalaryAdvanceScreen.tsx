import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  AdvanceEmployee,
  AdvancePayload,
  AdvanceRow,
  approveAdvance,
  bulkApproveAdvances,
  bulkApproveAllAdvances,
  bulkMarkPaidAdvances,
  bulkMarkPaidAllAdvances,
  createAdvance,
  deleteAdvance,
  EligibilityInfo,
  getAdvances,
  getApprovedSummary,
  getEligibility,
  getPendingSummary,
  markAdvancePaid,
  rejectAdvance,
  searchAdvanceEmployees,
  updateAdvance,
} from '../../api/adminSalaryAdvanceApi';

const A = colors.admin;
const STATUS_COLOR: Record<string, string> = { Pending: '#d97706', Approved: '#15803d', Paid: '#2563eb', Rejected: '#b91c1c' };
const PAGE_SIZE = 15;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SalaryAdvanceScreen({ params }: { params?: { salaryAdvanceId?: number } }) {
  const insets = useSafeAreaInsets();
  // Set from a notification tap ("SalaryAdvanceRequested") — highlights that
  // specific request's card once it's loaded (defaults to the Pending filter
  // below, where a fresh request already lives).
  const highlightId = params?.salaryAdvanceId;
  const [status, setStatus] = useState('Pending');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: AdvanceRow } | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [approvedSummary, setApprovedSummary] = useState<{ count: number; totalAmount: number } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<number>>(new Set());
  const [selectAllPendingMode, setSelectAllPendingMode] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<{ count: number; totalAmount: number } | null>(null);
  const [bulkApproveConfirmOpen, setBulkApproveConfirmOpen] = useState(false);
  const [bulkApproveBusy, setBulkApproveBusy] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getAdvances({ status: status || undefined, search: search || undefined, page: p, pageSize: PAGE_SIZE });
      setRows(res.data.advances);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
      // Selection is scoped to the currently visible page — a fresh page load
      // means the previously-selected rows may no longer be on screen.
      setSelectedIds(new Set());
      setSelectAllMode(false);
      setSelectedPendingIds(new Set());
      setSelectAllPendingMode(false);
    } catch {
      Alert.alert('Could not load salary advances');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  const loadApprovedSummary = useCallback(async () => {
    try {
      const res = await getApprovedSummary();
      setApprovedSummary({ count: res.data.count, totalAmount: res.data.totalAmount });
    } catch {
      setApprovedSummary(null);
    }
  }, []);

  const loadPendingSummary = useCallback(async () => {
    try {
      const res = await getPendingSummary();
      setPendingSummary({ count: res.data.count, totalAmount: res.data.totalAmount });
    } catch {
      setPendingSummary(null);
    }
  }, []);

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    loadApprovedSummary();
    loadPendingSummary();
  }, [loadApprovedSummary, loadPendingSummary]);

  const handleApprove = (row: AdvanceRow) => {
    Alert.alert('Approve advance?', `${row.empName} — ₹${row.amountDisplay} for ${row.salaryMonthDisplay}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setBusyId(row.salaryAdvanceId);
          try {
            await approveAdvance(row.salaryAdvanceId);
            await load(page);
          } catch (err: any) {
            Alert.alert('Could not approve', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleMarkPaid = async (row: AdvanceRow) => {
    setBusyId(row.salaryAdvanceId);
    try {
      await markAdvancePaid(row.salaryAdvanceId);
      await load(page);
    } catch (err: any) {
      Alert.alert('Could not update', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (row: AdvanceRow) => {
    Alert.alert('Reject advance?', `${row.empName} — ₹${row.amountDisplay}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.salaryAdvanceId);
          try {
            await rejectAdvance(row.salaryAdvanceId);
            await load(page);
          } catch (err: any) {
            Alert.alert('Could not reject', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleDelete = (row: AdvanceRow) => {
    Alert.alert('Delete this record?', `${row.empName}'s advance record will be archived.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.salaryAdvanceId);
          try {
            await deleteAdvance(row.salaryAdvanceId);
            await load(page);
          } catch (err: any) {
            Alert.alert('Could not delete', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const approvedRows = rows.filter((r) => r.status === 'Approved');
  const allApprovedSelected = approvedRows.length > 0 && approvedRows.every((r) => selectedIds.has(r.salaryAdvanceId));
  const selectedRows = rows.filter((r) => selectedIds.has(r.salaryAdvanceId));
  // In "select all across pages" mode the bar/confirm dialog show the server-side
  // approved-summary totals instead of just what's loaded on this page.
  const bulkCount = selectAllMode ? approvedSummary?.count ?? 0 : selectedIds.size;
  const bulkTotal = selectAllMode ? approvedSummary?.totalAmount ?? 0 : selectedRows.reduce((s, r) => s + r.amount, 0);

  const toggleSelect = (id: number) => {
    setSelectAllMode(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectAllMode(false);
    setSelectedIds((prev) => {
      if (allApprovedSelected) return new Set();
      const next = new Set(prev);
      approvedRows.forEach((r) => next.add(r.salaryAdvanceId));
      return next;
    });
  };

  const handleBulkMarkPaid = async () => {
    setBulkBusy(true);
    try {
      const res = selectAllMode ? await bulkMarkPaidAllAdvances() : await bulkMarkPaidAdvances(Array.from(selectedIds));
      setBulkConfirmOpen(false);
      setSelectAllMode(false);
      await load(page);
      await loadApprovedSummary();
      Alert.alert('Marked as Paid', res.data.message);
    } catch (err: any) {
      Alert.alert('Could not mark as paid', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBulkBusy(false);
    }
  };

  const pendingRows = rows.filter((r) => r.status === 'Pending');
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every((r) => selectedPendingIds.has(r.salaryAdvanceId));
  const selectedPendingRows = rows.filter((r) => selectedPendingIds.has(r.salaryAdvanceId));
  const bulkApproveCount = selectAllPendingMode ? pendingSummary?.count ?? 0 : selectedPendingIds.size;
  const bulkApproveTotal = selectAllPendingMode ? pendingSummary?.totalAmount ?? 0 : selectedPendingRows.reduce((s, r) => s + r.amount, 0);

  const toggleSelectPending = (id: number) => {
    setSelectAllPendingMode(false);
    setSelectedPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    setSelectAllPendingMode(false);
    setSelectedPendingIds((prev) => {
      if (allPendingSelected) return new Set();
      const next = new Set(prev);
      pendingRows.forEach((r) => next.add(r.salaryAdvanceId));
      return next;
    });
  };

  const handleBulkApprove = async () => {
    setBulkApproveBusy(true);
    try {
      const res = selectAllPendingMode ? await bulkApproveAllAdvances() : await bulkApproveAdvances(Array.from(selectedPendingIds));
      setBulkApproveConfirmOpen(false);
      setSelectAllPendingMode(false);
      await load(page);
      await loadPendingSummary();
      Alert.alert('Approved', res.data.message);
    } catch (err: any) {
      Alert.alert('Could not approve', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBulkApproveBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search employee name or code..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(0)}
          returnKeyType="search"
        />
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      <View style={styles.topRow}>
        <View style={styles.filterPicker}>
          <Picker selectedValue={status} onValueChange={setStatus}>
            <Picker.Item label="All Statuses" value="" />
            <Picker.Item label="Pending" value="Pending" />
            <Picker.Item label="Approved" value="Approved" />
            <Picker.Item label="Paid" value="Paid" />
            <Picker.Item label="Rejected" value="Rejected" />
          </Picker>
        </View>
      </View>

      {pendingRows.length > 0 && (
        <View style={styles.selectAllRow}>
          <Pressable style={styles.selectAllOption} onPress={toggleSelectAllPending}>
            <View style={[styles.checkbox, !selectAllPendingMode && allPendingSelected && styles.checkboxChecked]}>
              {!selectAllPendingMode && allPendingSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>Select all Pending on this page</Text>
          </Pressable>
          {!!pendingSummary && pendingSummary.count > 0 && (
            <Pressable onPress={() => { setSelectedPendingIds(new Set()); setSelectAllPendingMode((v) => !v); }}>
              <Text style={[styles.selectAllLink, selectAllPendingMode && styles.selectAllLinkActive]}>
                {selectAllPendingMode ? '✓ ' : ''}Select all {pendingSummary.count} pending (₹{pendingSummary.totalAmount.toFixed(2)})
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {approvedRows.length > 0 && (
        <View style={styles.selectAllRow}>
          <Pressable style={styles.selectAllOption} onPress={toggleSelectAll}>
            <View style={[styles.checkbox, !selectAllMode && allApprovedSelected && styles.checkboxChecked]}>
              {!selectAllMode && allApprovedSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>Select all Approved on this page</Text>
          </Pressable>
          {!!approvedSummary && approvedSummary.count > 0 && (
            <Pressable onPress={() => { setSelectedIds(new Set()); setSelectAllMode((v) => !v); }}>
              <Text style={[styles.selectAllLink, selectAllMode && styles.selectAllLinkActive]}>
                {selectAllMode ? '✓ ' : ''}Select all {approvedSummary.count} approved (₹{approvedSummary.totalAmount.toFixed(2)})
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.salaryAdvanceId)}
          contentContainerStyle={[styles.content, bulkApproveCount > 0 && bulkCount > 0 && styles.contentDoubleBar]}
          ListHeaderComponent={<Text style={styles.countText}>{total} record{total === 1 ? '' : 's'}</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>No salary advances match this filter.</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
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
            ) : null
          }
          renderItem={({ item: row }) => (
            <View style={[styles.card, row.salaryAdvanceId === highlightId && styles.cardHighlighted]}>
              <View style={styles.cardHeader}>
                {row.status === 'Approved' && (
                  <Pressable style={styles.rowCheckboxWrap} hitSlop={8} onPress={() => toggleSelect(row.salaryAdvanceId)}>
                    <View style={[styles.checkbox, (selectAllMode || selectedIds.has(row.salaryAdvanceId)) && styles.checkboxChecked]}>
                      {(selectAllMode || selectedIds.has(row.salaryAdvanceId)) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </Pressable>
                )}
                {row.status === 'Pending' && (
                  <Pressable style={styles.rowCheckboxWrap} hitSlop={8} onPress={() => toggleSelectPending(row.salaryAdvanceId)}>
                    <View style={[styles.checkbox, (selectAllPendingMode || selectedPendingIds.has(row.salaryAdvanceId)) && styles.checkboxChecked]}>
                      {(selectAllPendingMode || selectedPendingIds.has(row.salaryAdvanceId)) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </Pressable>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {row.empName} <Text style={styles.code}>· {row.empCode}</Text>
                  </Text>
                  <Text style={styles.sub}>
                    {row.salaryMonthDisplay} · Requested {row.requestDateDisplay} · {row.transferVia}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[row.status] || A.muted) + '1f' }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[row.status] || A.muted }]}>{row.status}</Text>
                </View>
              </View>

              <Text style={styles.amount}>₹{row.amountDisplay}</Text>

              <View style={styles.eligBarWrap}>
                <View style={[styles.eligBarFill, { width: `${row.eligPct}%`, backgroundColor: row.eligCss === 'elig-over' ? '#dc2626' : '#16a34a' }]} />
              </View>
              <Text style={styles.eligText}>
                Cap: ₹{row.maxEligibleDisplay} ({row.presentDays} present + {row.leaveDays} leave = {row.eligibleDays}/{row.workingDays} days)
              </Text>
              {row.remarks ? <Text style={styles.remarks}>{row.remarks}</Text> : null}

              <View style={styles.actionsRow}>
                {row.status === 'Pending' && (
                  <>
                    <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(row)} disabled={busyId === row.salaryAdvanceId}>
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(row)} disabled={busyId === row.salaryAdvanceId}>
                      {busyId === row.salaryAdvanceId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                    </Pressable>
                  </>
                )}
                {row.status === 'Approved' && (
                  <Pressable style={[styles.actionBtn, styles.paidBtn]} onPress={() => handleMarkPaid(row)} disabled={busyId === row.salaryAdvanceId}>
                    {busyId === row.salaryAdvanceId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.approveText}>Mark Paid</Text>}
                  </Pressable>
                )}
                <Pressable style={styles.deleteIconBtn} onPress={() => handleDelete(row)}>
                  <Text style={styles.deleteIconText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {(bulkApproveCount > 0 || bulkCount > 0) && (
        <View style={[styles.bulkBarStack, { paddingBottom: insets.bottom }]}>
          {bulkApproveCount > 0 && (
            <View style={styles.bulkBar}>
              <View>
                <Text style={styles.bulkBarCount}>
                  {bulkApproveCount} selected{selectAllPendingMode ? ' (all pages)' : ''}
                </Text>
                <Text style={styles.bulkBarAmount}>₹{bulkApproveTotal.toFixed(2)}</Text>
              </View>
              <Pressable style={[styles.bulkBarBtn, styles.bulkBarBtnApprove]} onPress={() => setBulkApproveConfirmOpen(true)}>
                <Text style={styles.bulkBarBtnText}>Approve All</Text>
              </Pressable>
            </View>
          )}
          {bulkCount > 0 && (
            <View style={styles.bulkBar}>
              <View>
                <Text style={styles.bulkBarCount}>
                  {bulkCount} selected{selectAllMode ? ' (all pages)' : ''}
                </Text>
                <Text style={styles.bulkBarAmount}>₹{bulkTotal.toFixed(2)}</Text>
              </View>
              <Pressable style={styles.bulkBarBtn} onPress={() => setBulkConfirmOpen(true)}>
                <Text style={styles.bulkBarBtnText}>Mark as Paid</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {bulkApproveConfirmOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setBulkApproveConfirmOpen(false)}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setBulkApproveConfirmOpen(false)}>
            <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.confirmIconCircle, styles.confirmIconCircleGreen]}>
                <Icon name="check" size={26} color="#15803d" />
              </View>
              <Text style={styles.confirmTitle}>Approve {bulkApproveCount} Advance{bulkApproveCount === 1 ? '' : 's'}?</Text>

              <View style={[styles.confirmInfoBox, styles.confirmInfoBoxGreen]}>
                <Text style={styles.confirmInfoLine}>
                  You're about to approve <Text style={styles.confirmInfoStrong}>{bulkApproveCount}</Text> pending advance{bulkApproveCount === 1 ? '' : 's'}
                  {selectAllPendingMode ? ' — every pending advance across all pages —' : ''}
                </Text>
                <Text style={[styles.confirmInfoAmount, styles.confirmInfoAmountGreen]}>Total Amount: ₹{bulkApproveTotal.toFixed(2)}</Text>
              </View>

              <Text style={styles.confirmDesc}>Only advances still Pending will be approved; any already actioned will be skipped.</Text>

              <View style={styles.confirmActions}>
                <Button title="Cancel" variant="outline" onPress={() => setBulkApproveConfirmOpen(false)} style={{ flex: 1 }} />
                <Button title="Approve All" onPress={handleBulkApprove} loading={bulkApproveBusy} style={{ flex: 1 }} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {bulkConfirmOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setBulkConfirmOpen(false)}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setBulkConfirmOpen(false)}>
            <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.confirmIconCircle}>
                <Icon name="check" size={26} color="#2563eb" />
              </View>
              <Text style={styles.confirmTitle}>Mark {bulkCount} Advance{bulkCount === 1 ? '' : 's'} as Paid?</Text>

              <View style={styles.confirmInfoBox}>
                <Text style={styles.confirmInfoLine}>
                  You're about to mark <Text style={styles.confirmInfoStrong}>{bulkCount}</Text> approved advance{bulkCount === 1 ? '' : 's'}
                  {selectAllMode ? ' — every approved advance across all pages —' : ''} as Paid
                </Text>
                <Text style={styles.confirmInfoAmount}>Total Amount: ₹{bulkTotal.toFixed(2)}</Text>
              </View>

              <Text style={styles.confirmDesc}>This will record today's date as the payment date for each of these. Make sure the payment has actually gone out before confirming.</Text>

              <View style={styles.confirmActions}>
                <Button title="Cancel" variant="outline" onPress={() => setBulkConfirmOpen(false)} style={{ flex: 1 }} />
                <Button title="Mark as Paid" onPress={handleBulkMarkPaid} loading={bulkBusy} style={{ flex: 1 }} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {formTarget && (
        <ApplyModal
          row={formTarget.row}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load(page);
          }}
        />
      )}
    </View>
  );
}

function ApplyModal({ row, onClose, onSaved }: { row?: AdvanceRow; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [emp, setEmp] = useState<AdvanceEmployee | null>(row ? { id: row.employeeId, name: row.empName, code: row.empCode, salary: 0 } : null);
  const [empSearch, setEmpSearch] = useState('');
  const [empResults, setEmpResults] = useState<AdvanceEmployee[]>([]);
  const [salaryMonth, setSalaryMonth] = useState(currentMonthKey());
  const [amount, setAmount] = useState(row?.amount ? String(row.amount) : '');
  const [transferVia, setTransferVia] = useState(row?.transferVia || 'Cash');
  const [bankReference, setBankReference] = useState(row?.bankReference || '');
  const [remarks, setRemarks] = useState(row?.remarks || '');
  const [eligInfo, setEligInfo] = useState<EligibilityInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!empSearch) {
      setEmpResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchAdvanceEmployees(empSearch).then((res) => setEmpResults(res.data.employees)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  useEffect(() => {
    if (emp && salaryMonth) getEligibility(emp.id, salaryMonth).then((res) => setEligInfo(res.data)).catch(() => setEligInfo(null));
  }, [emp, salaryMonth]);

  const save = async () => {
    if (!emp) return Alert.alert('Please select an employee.');
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid amount (> 0).');
    if (!salaryMonth) return Alert.alert('Please select a salary month.');

    const payload: AdvancePayload = { employeeId: emp.id, amount: amt, salaryMonth, transferVia, bankReference, remarks };
    setSaving(true);
    try {
      const res = isEdit ? await updateAdvance(row!.salaryAdvanceId, payload) : await createAdvance(payload);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Salary Advance' : 'Add Salary Advance'}</Text>

            {!isEdit && (
              <>
                <TextField label="Employee" placeholder="Search name or code..." value={emp ? `${emp.name} (${emp.code})` : empSearch} onChangeText={(v) => { setEmp(null); setEmpSearch(v); }} />
                {empResults.length > 0 && !emp && (
                  <View style={styles.empResultsBox}>
                    {empResults.map((e) => (
                      <Pressable key={e.id} style={styles.empResultRow} onPress={() => { setEmp(e); setEmpSearch(''); setEmpResults([]); }}>
                        <Text style={styles.empResultText}>{e.name} ({e.code})</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
            {isEdit && <Text style={styles.readonlyEmp}>{emp?.name} ({emp?.code})</Text>}

            <DateField label="Salary Month" granularity="month" value={salaryMonth} onChange={setSalaryMonth} placeholder="Select month" />
            <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

            <Text style={styles.label}>Transfer Via</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={transferVia} onValueChange={setTransferVia}>
                <Picker.Item label="Cash" value="Cash" />
                <Picker.Item label="Bank" value="Bank" />
                <Picker.Item label="UPI" value="UPI" />
              </Picker>
            </View>

            <TextField label="Bank Reference" value={bankReference} onChangeText={setBankReference} />
            <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

            {eligInfo && (
              <View style={styles.eligInfoBox}>
                <Text style={styles.eligInfoTitle}>25% Advance Cap — {eligInfo.monthLabel}</Text>
                <Text style={styles.eligInfoLine}>
                  ₹{eligInfo.monthlySalary.toFixed(0)} ÷ {eligInfo.workingDays} days = ₹{eligInfo.perDay.toFixed(2)}/day
                </Text>
                <Text style={styles.eligInfoLine}>
                  {eligInfo.presentDays} present + {eligInfo.leaveDays} leave = {eligInfo.eligibleDays} eligible days{eligInfo.isPartialMonth ? ` (up to ${eligInfo.upToDisplay})` : ''}
                </Text>
                <Text style={styles.eligInfoCap}>Max: ₹{eligInfo.maxEligible.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={isEdit ? 'Save Changes' : 'Submit'} onPress={save} loading={saving} style={{ flex: 1 }} />
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
  content: { padding: spacing(2), paddingBottom: spacing(9) },
  contentDoubleBar: { paddingBottom: spacing(16) },
  topRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  searchInput: { flex: 1, height: 42, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  filterPicker: { flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHighlighted: { borderWidth: 2, borderColor: A.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  code: { fontWeight: '500', color: A.muted },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  amount: { fontSize: 22, fontWeight: '800', color: A.ink, marginBottom: 8 },

  eligBarWrap: { height: 6, backgroundColor: A.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  eligBarFill: { height: 6, borderRadius: 3 },
  eligText: { fontSize: 11, color: A.muted },
  remarks: { fontSize: 12, color: A.muted, fontStyle: 'italic', marginTop: 6 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  rejectText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  approveBtn: { backgroundColor: '#15803d' },
  paidBtn: { backgroundColor: '#2563eb' },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  deleteIconBtn: { height: 38, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deleteIconText: { color: A.muted, fontSize: 12, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '90%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  readonlyEmp: { fontSize: 14, fontWeight: '700', color: A.ink, marginBottom: 16 },
  empResultsBox: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginTop: -8, marginBottom: 16, backgroundColor: A.surface, maxHeight: 160 },
  empResultRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  empResultText: { fontSize: 13, color: A.ink },
  eligInfoBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  eligInfoTitle: { fontSize: 12, fontWeight: '700', color: A.ink, marginBottom: 4 },
  eligInfoLine: { fontSize: 11, color: A.muted, marginBottom: 2 },
  eligInfoCap: { fontSize: 13, fontWeight: '800', color: '#16a34a', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },

  selectAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
  selectAllOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { fontSize: 12, color: A.ink, fontWeight: '600' },
  selectAllLink: { fontSize: 12, color: A.primary, fontWeight: '700' },
  selectAllLinkActive: { color: '#2563eb' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface },
  checkboxChecked: { backgroundColor: A.primary, borderColor: A.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  rowCheckboxWrap: { paddingTop: 2 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: spacing(1) },
  pageBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  pageInfo: { fontSize: 12, color: A.muted, fontWeight: '600' },

  bulkBarStack: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: A.surface,
    borderTopWidth: 1,
    borderTopColor: A.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    ...shadow.card,
  },
  bulkBarCount: { fontSize: 13, fontWeight: '700', color: A.ink },
  bulkBarAmount: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  bulkBarBtn: { backgroundColor: '#2563eb', borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 12 },
  bulkBarBtnApprove: { backgroundColor: '#15803d' },
  bulkBarBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: A.surface, borderRadius: radius.lg, padding: spacing(3), alignItems: 'center' },
  confirmIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: spacing(1.5) },
  confirmIconCircleGreen: { backgroundColor: '#dcfce7' },
  confirmTitle: { fontSize: 16, fontWeight: '800', color: A.ink, textAlign: 'center', marginBottom: spacing(2) },
  confirmInfoBox: { width: '100%', backgroundColor: '#eff6ff', borderRadius: radius.sm, padding: 14, alignItems: 'center', marginBottom: spacing(1.5) },
  confirmInfoBoxGreen: { backgroundColor: '#f0fdf4' },
  confirmInfoLine: { fontSize: 13, color: A.ink, textAlign: 'center' },
  confirmInfoStrong: { fontWeight: '800' },
  confirmInfoAmount: { fontSize: 20, fontWeight: '800', color: '#2563eb', marginTop: 6 },
  confirmInfoAmountGreen: { color: '#15803d' },
  confirmDesc: { fontSize: 12, color: A.muted, textAlign: 'center', marginBottom: spacing(2) },
  confirmActions: { flexDirection: 'row', gap: 10, width: '100%' },
});
