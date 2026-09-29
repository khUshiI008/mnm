import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import TrialGate from './TrialGate';
import { colors, spacing } from '../../theme';
import { getAdvances, AdvanceItem, getAdvanceRequestStatus, requestAdvance, AdvanceRequestStatus } from '../../api/advanceApi';

const STATUS_CSS: Record<string, string> = { Approved: 'partial', Paid: 'present', Rejected: 'absent', Pending: 'weekend' };
const WINDOW_BADGE_LABEL: Record<string, string> = { open: 'Request Window Open', soon: 'Opens on 21st', closed: 'Window Closed' };
const WINDOW_BADGE_CSS: Record<string, string> = { open: 'present', soon: 'weekend', closed: 'absent' };

export default function AdvancesScreen({ navigation }: any) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [advances, setAdvances] = useState<AdvanceItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, paid: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [trial, setTrial] = useState(false);
  const [reqStatus, setReqStatus] = useState<AdvanceRequestStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [advRes, statusRes] = await Promise.all([getAdvances(year), getAdvanceRequestStatus().catch(() => null)]);
      setAdvances(advRes.data.advances);
      setCounts(advRes.data.counts);
      if (statusRes) setReqStatus(statusRes.data);
    } catch (err: any) {
      if (err?.response?.data?.code === 'TRIAL_PENDING') setTrial(true);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const res = await requestAdvance();
      if (res.data.success) {
        Alert.alert('Request submitted', res.data.message);
        load();
      } else {
        Alert.alert('Could not submit', res.data.message);
      }
    } catch (err: any) {
      Alert.alert('Could not submit', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (trial) return <TrialGate navigation={navigation} />;

  return (
    <FlatList
      style={styles.screen}
      data={advances}
      keyExtractor={(a) => String(a.salaryAdvanceId)}
      refreshing={loading}
      onRefresh={load}
      contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(5) }}
      ListHeaderComponent={
        <View>
          {reqStatus?.visible && (
            <Card style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestTitle}>Request Advance</Text>
                <StatusBadge statusCss={WINDOW_BADGE_CSS[reqStatus.windowStatus]} label={WINDOW_BADGE_LABEL[reqStatus.windowStatus]} />
              </View>

              {reqStatus.existing ? (
                <>
                  <Text style={styles.requestAmount}>Rs. {reqStatus.existing.amount.toFixed(2)}</Text>
                  <Text style={styles.requestMeta}>
                    {reqStatus.existing.status} · {reqStatus.existing.salaryMonthDisplay} · requested {reqStatus.existing.requestDateDisplay}
                  </Text>
                  {reqStatus.existing.approvedBy ? <Text style={styles.requestMeta}>Approved by {reqStatus.existing.approvedBy}</Text> : null}
                </>
              ) : reqStatus.eligible ? (
                <>
                  <View style={styles.eligibleBox}>
                    <Text style={styles.eligibleLabel}>Your eligible advance amount</Text>
                    <Text style={styles.eligibleAmount}>Rs. {reqStatus.capAmount.toFixed(2)}</Text>
                    <Text style={styles.eligibleNote}>Attendance up to 20th · 25% cap</Text>
                  </View>
                  <Button title="Request Advance" onPress={handleRequest} loading={submitting} />
                </>
              ) : (
                <Text style={styles.requestLockedText}>{reqStatus.message}</Text>
              )}
            </Card>
          )}

          <View style={styles.yearRow}>
            <Button title="< Prev" variant="outline" onPress={() => setYear((y) => y - 1)} />
            <Text style={styles.yearLabel}>{year}</Text>
            <Button title="Next >" variant="outline" onPress={() => setYear((y) => y + 1)} />
          </View>
          <Text style={styles.countLine}>
            {counts.total} record(s) · {counts.pending} pending · {counts.approved} approved · {counts.paid} paid ·{' '}
            {counts.rejected} rejected
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.amount}>Rs. {item.amount.toFixed(2)}</Text>
            <StatusBadge statusCss={STATUS_CSS[item.status] || 'weekend'} label={item.status} />
          </View>
          <Text style={styles.meta}>
            Requested {formatDate(item.requestDate)} · For {monthName(item.salaryMonth)}
          </Text>
          <Text style={styles.meta}>
            Via {item.transferVia || '—'} {item.bankReference ? `· Ref ${item.bankReference}` : ''}
          </Text>
          {item.approvedBy ? <Text style={styles.meta}>Approved by {item.approvedBy}</Text> : null}
          {item.paidDate ? <Text style={styles.meta}>Paid on {formatDate(item.paidDate)}</Text> : null}
          {item.remarks ? <Text style={styles.remarks}>{item.remarks}</Text> : null}
        </Card>
      )}
      ListEmptyComponent={
        !loading ? <Text style={styles.empty}>No advance requests for {year}. Contact HR to request a salary advance.</Text> : null
      }
    />
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function monthName(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  requestCard: { marginBottom: spacing(2) },
  requestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  requestTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  requestAmount: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  requestMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  requestLockedText: { fontSize: 13, color: colors.textMuted },
  eligibleBox: { backgroundColor: colors.background, borderRadius: 12, padding: 14, marginBottom: spacing(1.5) },
  eligibleLabel: { fontSize: 12, color: colors.textMuted },
  eligibleAmount: { fontSize: 26, fontWeight: '800', color: colors.primary, marginVertical: 4 },
  eligibleNote: { fontSize: 11, color: colors.textMuted },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  yearLabel: { fontSize: 18, fontWeight: '800', color: colors.text },
  countLine: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(2) },
  card: { marginBottom: spacing(1.5) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  amount: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  remarks: { fontSize: 11, color: colors.warning, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing(4) },
});
