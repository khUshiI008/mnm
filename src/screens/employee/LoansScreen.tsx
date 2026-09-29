import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import TrialGate from './TrialGate';
import { colors, spacing } from '../../theme';
import { getLoans, LoanItem } from '../../api/loanApi';
import { getLoanRequestStatus, LoanRequestStatus } from '../../api/employeeLoanRequestApi';

const STATUS_CSS: Record<string, string> = { Active: 'partial', Completed: 'present', Cancelled: 'weekend' };
const REQUEST_STATUS_CSS: Record<string, string> = { Pending: 'weekend', Approved: 'present', Rejected: 'absent' };

export default function LoansScreen({ navigation }: any) {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [trial, setTrial] = useState(false);
  const [reqStatus, setReqStatus] = useState<LoanRequestStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statusRes] = await Promise.all([getLoans(), getLoanRequestStatus().catch(() => null)]);
      setLoans(res.data.loans);
      if (statusRes) setReqStatus(statusRes.data);
    } catch (err: any) {
      if (err?.response?.data?.code === 'TRIAL_PENDING') setTrial(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  if (trial) return <TrialGate navigation={navigation} />;

  return (
    <FlatList
      style={styles.screen}
      data={loans}
      keyExtractor={(l) => `${l.loanType}-${l.staffLoanId}`}
      refreshing={loading}
      onRefresh={load}
      contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(5) }}
      ListHeaderComponent={
        <Card style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Text style={styles.requestTitle}>Request a Loan</Text>
            {reqStatus?.pending ? (
              <StatusBadge statusCss={REQUEST_STATUS_CSS[reqStatus.pending.status] || 'weekend'} label={reqStatus.pending.status} />
            ) : null}
          </View>
          {reqStatus?.pending ? (
            <>
              <Text style={styles.requestAmount}>Rs. {reqStatus.pending.requestedAmountDisplay}</Text>
              <Text style={styles.requestMeta}>
                {reqStatus.pending.requestedEMIs} EMIs requested · submitted {reqStatus.pending.requestDateDisplay}
              </Text>
              <Text style={styles.requestLockedText}>Awaiting admin review.</Text>
            </>
          ) : (
            <>
              <Text style={styles.requestLockedText}>
                Need funds? Submit a loan request with a cheque photo and your signature for admin approval.
              </Text>
              <Button title="Request a Loan" onPress={() => navigation.navigate('RequestLoan')} style={{ marginTop: spacing(1.5) }} />
            </>
          )}
        </Card>
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.ref}>{item.loanRef}</Text>
            <View style={[styles.typeBadge, item.loanType === 'payroll' && styles.typeBadgePayroll]}>
              <Text style={[styles.typeBadgeText, item.loanType === 'payroll' && styles.typeBadgeTextPayroll]}>
                {item.loanType === 'payroll' ? 'Inhouse Loan' : 'Brand Loan'}
              </Text>
            </View>
            <Text style={styles.amount}>Rs. {item.loanAmount.toFixed(2)}</Text>
            <StatusBadge statusCss={STATUS_CSS[item.status] || 'partial'} label={item.status} />
          </View>
          <Text style={styles.meta}>
            Disbursed: {formatDate(item.disbursalDate)} · EMIs: {item.totalEmis} total, {item.paidEmis} paid, {item.pendingEmis} pending
          </Text>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}

          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Paid: Rs. {item.paidAmount.toFixed(2)}</Text>
              <Text style={styles.progressLabel}>Remaining: Rs. {item.remainingAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${item.progressPct}%` }]} />
            </View>
          </View>

          {item.lumpSumPayments.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subTitle}>Lump Sum Payments ({item.lumpSumPayments.length})</Text>
              {item.lumpSumPayments.map((lp, i) => (
                <View key={i} style={styles.subRowBlock}>
                  <Text style={styles.subRow}>
                    {formatDate(lp.paymentDate)} · Rs. {lp.amountPaid.toFixed(2)} · {lp.paymentMode || '—'}
                  </Text>
                  {lp.reschedulingOption ? <Text style={styles.subRowDetail}>Rescheduling: {lp.reschedulingOption}</Text> : null}
                  {lp.remarks ? <Text style={styles.subRowDetail}>Remarks: {lp.remarks}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {item.topUps.length > 0 && (
            <View style={styles.subSection}>
              <Text style={styles.subTitle}>Top-Up Disbursements ({item.topUps.length})</Text>
              {item.topUps.map((tu, i) => (
                <View key={i} style={styles.subRowBlock}>
                  <Text style={styles.subRow}>
                    {formatDate(tu.disbursalDate)} · Rs. {tu.amountGiven.toFixed(2)} · {tu.paymentMode || '—'}
                  </Text>
                  {tu.reschedulingOption ? <Text style={styles.subRowDetail}>EMI Adjustment: {tu.reschedulingOption}</Text> : null}
                  {tu.remarks ? <Text style={styles.subRowDetail}>Remarks: {tu.remarks}</Text> : null}
                </View>
              ))}
            </View>
          )}

          <View style={styles.subSection}>
            <Text style={styles.subTitle}>EMI Schedule</Text>
            {item.emiSchedule.map((emi) => (
              <View key={emi.emiScheduleId} style={[styles.emiRow, emi.isNext && styles.emiRowNext]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.emiTopLine}>
                    <Text style={styles.emiNumber}>
                      {emi.emiNumber}/{emi.totalEmis}
                    </Text>
                    <Text style={styles.emiDue}>{formatDate(emi.dueDate)}</Text>
                    <Text style={styles.emiAmount}>Rs. {emi.emiAmount.toFixed(2)}</Text>
                  </View>
                  {emi.status === 'Received' && (
                    <Text style={styles.emiDetail}>
                      Received: Rs. {(emi.receivedAmount ?? emi.emiAmount).toFixed(2)}
                      {emi.paymentMode ? ` · ${emi.paymentMode}` : ''}
                    </Text>
                  )}
                  {emi.remarks ? <Text style={styles.emiDetail}>Remarks: {emi.remarks}</Text> : null}
                </View>
                <StatusBadge statusCss={emi.status === 'Received' ? 'present' : 'partial'} label={emi.status} />
              </View>
            ))}
          </View>
        </Card>
      )}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>No loans on record. Contact HR if you believe this is an error.</Text> : null}
    />
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  requestCard: { marginBottom: spacing(2) },
  requestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  requestTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  requestAmount: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  requestMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  requestLockedText: { fontSize: 13, color: colors.textMuted },
  card: { marginBottom: spacing(2) },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginBottom: 6, flexWrap: 'wrap' },
  ref: { fontWeight: '700', color: colors.text },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.primary + '1f' },
  typeBadgePayroll: { backgroundColor: '#e0f2fe' },
  typeBadgeText: { fontSize: 9.5, fontWeight: '800', color: colors.primary },
  typeBadgeTextPayroll: { color: '#0369a1' },
  amount: { fontWeight: '800', color: colors.primary },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  desc: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(1) },
  progressWrap: { marginBottom: spacing(1.5) },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 11, color: colors.textMuted },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressBar: { height: 8, backgroundColor: colors.primary },
  subSection: { marginTop: spacing(1) },
  subTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subRow: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  subRowBlock: { marginBottom: 6 },
  subRowDetail: { fontSize: 10.5, color: colors.textMuted, marginLeft: 8, fontStyle: 'italic' },
  emiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  emiRowNext: { backgroundColor: colors.primary + '10' },
  emiTopLine: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  emiNumber: { width: 40, fontSize: 11, color: colors.textMuted },
  emiDue: { flex: 1, fontSize: 11, color: colors.text },
  emiAmount: { fontSize: 12, fontWeight: '700', color: colors.text, marginRight: 6 },
  emiDetail: { fontSize: 10.5, color: colors.textMuted, marginTop: 2, marginLeft: 40 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing(4) },
});
