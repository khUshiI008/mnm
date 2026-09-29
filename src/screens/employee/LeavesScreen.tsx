import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import StatusBadge from '../../components/StatusBadge';
import TrialGate from './TrialGate';
import { colors, spacing } from '../../theme';
import { applyLeave, getLeaveApplications, getLeaveBalances, getLeaveTypes, LeaveApplicationItem, LeaveBalanceItem, LeaveTypeOption } from '../../api/leaveApi';

const STATUS_CSS: Record<string, string> = { Approved: 'present', Rejected: 'absent', Cancelled: 'weekend', Pending: 'partial' };

export default function LeavesScreen({ navigation }: any) {
  const [trial, setTrial] = useState(false);
  const [types, setTypes] = useState<LeaveTypeOption[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [applications, setApplications] = useState<LeaveApplicationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isTrialError = (err: any) => err?.response?.data?.code === 'TRIAL_PENDING';

  const clBalance = useMemo(() => balances.find((b) => b.shortCode.toUpperCase() === 'CL') || null, [balances]);

  // Employees can't self-apply across their weekly off (Sat/Sun) — only an
  // admin can put that through (Panel/LeaveApplication, auto-approved on
  // submit). Caught here so the Submit button disables before they even try,
  // instead of round-tripping to the server for the same rejection.
  const includesWeekend = useMemo(() => {
    if (!fromDate || !toDate) return false;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return false;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return true;
    }
    return false;
  }, [fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, b, a] = await Promise.all([
        getLeaveTypes(),
        getLeaveBalances(),
        getLeaveApplications(statusFilter || undefined),
      ]);
      setTypes(t.data.types);
      if (t.data.types.length && leaveTypeId == null) setLeaveTypeId(t.data.types[0].leaveTypeId);
      setBalances(b.data.balances);
      setApplications(a.data.applications);
    } catch (err: any) {
      if (isTrialError(err)) setTrial(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!leaveTypeId) return Alert.alert('Select a leave type');
    if (!fromDate || !toDate) return Alert.alert('Select both From and To dates');
    if (includesWeekend) {
      return Alert.alert(
        'Weekly off selected',
        'Your selected dates include a Saturday/Sunday (your weekly off). Please ask your admin to apply this leave on your behalf — it will be approved immediately.'
      );
    }
    if (!reason.trim()) return Alert.alert('Please enter a reason');

    setSubmitting(true);
    try {
      const res = await applyLeave({ leaveTypeId, fromDate, toDate, reason: reason.trim() });
      Alert.alert('Submitted', (res.data as any).message);
      setFromDate('');
      setToDate('');
      setReason('');
      load();
    } catch (err: any) {
      if (isTrialError(err)) setTrial(true);
      else Alert.alert('Could not submit', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (trial) return <TrialGate navigation={navigation} />;

  return (
    <FlatList
      style={styles.screen}
      data={applications}
      keyExtractor={(a) => String(a.leaveApplicationId)}
      refreshing={loading}
      onRefresh={load}
      contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(5) }}
      ListHeaderComponent={
        <View>
          {clBalance && (
            <Card style={[styles.clCard, clBalance.remaining <= 0 && styles.clCardExhausted]}>
              <Text style={styles.clLabel}>
                CASUAL LEAVE ({clBalance.shortCode})
              </Text>
              <Text style={[styles.clRemaining, { color: clBalance.remaining <= 0 ? colors.danger : colors.success }]}>
                {clBalance.remaining.toFixed(1)}
              </Text>
              <Text style={styles.clSub}>days remaining</Text>
              <View style={styles.clDetailRow}>
                <Text style={styles.clDetail}>Entitled {clBalance.entitled}</Text>
                <Text style={styles.clDetail}>Used {clBalance.used.toFixed(1)}</Text>
                <Text style={styles.clDetail}>{clBalance.isPaidLeave ? 'Paid' : 'LWP'}</Text>
              </View>
              {clBalance.remaining <= 0 && <Text style={styles.clWarning}>Your CL quota for this month is fully consumed.</Text>}
            </Card>
          )}

          <Text style={styles.sectionTitle}>This month's balance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing(2) }}>
            {balances.map((b) => (
              <Card key={b.leaveTypeId} style={styles.balanceCard}>
                <Text style={styles.balanceType}>
                  {b.name} ({b.shortCode})
                </Text>
                <Text style={[styles.balanceRemaining, { color: b.remaining <= 0 ? colors.danger : colors.success }]}>
                  {b.remaining}
                </Text>
                <Text style={styles.balanceSub}>days remaining</Text>
                <Text style={styles.balanceDetail}>Entitled {b.entitled} · Used {b.used}</Text>
              </Card>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Apply for leave</Text>
          <Card style={{ marginBottom: spacing(2) }}>
            <Text style={styles.label}>Leave type</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={leaveTypeId} onValueChange={(v) => setLeaveTypeId(v)}>
                {types.map((t) => (
                  <Picker.Item key={t.leaveTypeId} label={`${t.name} (${t.shortCode}) — ${t.isPaidLeave ? 'Paid' : 'LWP'}`} value={t.leaveTypeId} />
                ))}
              </Picker>
            </View>
            <DateField label="From" granularity="day" value={fromDate} onChange={setFromDate} placeholder="Select date" />
            <DateField label="To" granularity="day" value={toDate} onChange={setToDate} placeholder="Select date" />
            {includesWeekend && (
              <Text style={styles.weekendWarning}>
                🚫 Your selected dates include a Saturday/Sunday (your weekly off). You can't apply for this yourself — ask your admin to apply it on your behalf; it'll be approved immediately.
              </Text>
            )}
            <TextField label="Reason" value={reason} onChangeText={setReason} multiline numberOfLines={3} />
            <Button title="Submit application" onPress={submit} loading={submitting} disabled={includesWeekend} />
          </Card>

          <View style={styles.filterRow}>
            <Text style={styles.sectionTitle}>My applications</Text>
            <View style={styles.pickerWrapSmall}>
              <Picker selectedValue={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <Picker.Item label="All" value="" />
                <Picker.Item label="Pending" value="Pending" />
                <Picker.Item label="Approved" value="Approved" />
                <Picker.Item label="Rejected" value="Rejected" />
                <Picker.Item label="Cancelled" value="Cancelled" />
              </Picker>
            </View>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.appCard}>
          <View style={styles.appHeader}>
            <Text style={styles.appType}>
              {item.leaveTypeName} ({item.shortCode})
            </Text>
            <StatusBadge statusCss={STATUS_CSS[item.status] || 'partial'} label={item.status} />
          </View>
          <Text style={styles.appDates}>
            {formatDate(item.fromDate)} → {formatDate(item.toDate)} · {item.totalDays} day(s)
          </Text>
          <Text style={styles.appReason}>{item.reason}</Text>
          <Text style={styles.appMeta}>Approver: {item.approverName}</Text>
          {item.remarks ? <Text style={styles.appRemarks}>Remarks: {item.remarks}</Text> : null}
        </Card>
      )}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>No leave applications yet.</Text> : null}
    />
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  clCard: { marginBottom: spacing(2), borderLeftWidth: 4, borderLeftColor: colors.primary },
  clCardExhausted: { borderLeftColor: colors.danger },
  clLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  clRemaining: { fontSize: 30, fontWeight: '800', marginTop: 4 },
  clSub: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
  clDetailRow: { flexDirection: 'row', gap: spacing(2) },
  clDetail: { fontSize: 11, color: colors.textMuted },
  clWarning: { fontSize: 12, color: colors.danger, marginTop: 8, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing(1) },
  balanceCard: { width: 160, marginRight: spacing(1.5) },
  balanceType: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  balanceRemaining: { fontSize: 26, fontWeight: '800' },
  balanceSub: { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  balanceDetail: { fontSize: 11, color: colors.textMuted },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: spacing(2), backgroundColor: colors.surface },
  weekendWarning: { fontSize: 12, color: colors.danger, backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: spacing(1.5), lineHeight: 17 },
  pickerWrapSmall: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, width: 140 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  appCard: { marginBottom: spacing(1.5) },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  appType: { fontWeight: '700', color: colors.text },
  appDates: { color: colors.text, fontSize: 13, marginBottom: 4 },
  appReason: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  appMeta: { color: colors.textMuted, fontSize: 11 },
  appRemarks: { color: colors.warning, fontSize: 11, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing(4) },
});
