import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
import DateField from '../../components/DateField';
import { getSoldBarcodePayments, markSoldBarcodePaid, bulkMarkSoldBarcode, SoldBarcodeRow } from '../../api/soldBarcodePaymentsApi';

const A = colors.admin;

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * Node port of Panel/Sales/SoldBarcodeList/Index.aspx — rows are computed on
 * the fly (sales x each barcode target's own rate), never stored; only the
 * paid/unpaid status is persisted. Mark Paid is per row/role (Employee or
 * Manager); "Mark All Paid/Unpaid" applies to every row currently matching
 * the filter (not just the visible page), same as the .NET bulk actions.
 */
export default function SoldBarcodePaymentsScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SoldBarcodeRow[]>([]);
  const [totals, setTotals] = useState({ employee: 0, manager: 0 });
  const [filteredRowKeys, setFilteredRowKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSoldBarcodePayments({ from: from || undefined, to: to || undefined, search: search.trim() || undefined });
      setRows(res.data.rows);
      setTotals({ employee: res.data.totalEmployeeEarned, manager: res.data.totalManagerEarned });
      setFilteredRowKeys(res.data.filteredRowKeys);
    } catch {
      Alert.alert('Could not load Sold Barcode Payments');
    } finally {
      setLoading(false);
    }
  }, [from, to, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMark = async (row: SoldBarcodeRow, role: 'Employee' | 'Manager') => {
    setBusyKey(`${row.rowKey}|${role}`);
    try {
      const res = await markSoldBarcodePaid(row.rowKey, role);
      if (!res.data.success) {
        Alert.alert('Could not mark paid', res.data.message || 'Please try again.');
        return;
      }
      await load();
    } catch (err: any) {
      Alert.alert('Could not mark paid', err?.response?.data?.message || 'Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulk = (action: 'pay' | 'unpay') => {
    if (!filteredRowKeys.length) return;
    Alert.alert(
      action === 'pay' ? 'Mark All Paid?' : 'Mark All Unpaid?',
      `This applies to all ${filteredRowKeys.length} filtered row(s) (both employee and manager where eligible).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBulkBusy(true);
            try {
              await bulkMarkSoldBarcode(filteredRowKeys, action);
              await load();
            } catch {
              Alert.alert('Bulk action failed', 'Please try again.');
            } finally {
              setBulkBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <DateField label="From" granularity="day" value={from} onChange={setFrom} placeholder="Month start" />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="To" granularity="day" value={to} onChange={setTo} placeholder="Today" />
        </View>
      </View>
      <TextInput style={styles.searchInput} placeholder="Search bill / item / employee..." placeholderTextColor={A.muted} value={search} onChangeText={setSearch} />

      <View style={styles.totalsRow}>
        <Text style={styles.totalChip}>Employee: {money(totals.employee)}</Text>
        <Text style={styles.totalChip}>Manager: {money(totals.manager)}</Text>
      </View>

      <View style={styles.bulkRow}>
        <Pressable style={[styles.bulkBtn, styles.bulkPay]} onPress={() => handleBulk('pay')} disabled={bulkBusy}>
          <Text style={styles.bulkPayText}>Mark All Paid</Text>
        </Pressable>
        <Pressable style={[styles.bulkBtn, styles.bulkUnpay]} onPress={() => handleBulk('unpay')} disabled={bulkBusy}>
          <Text style={styles.bulkUnpayText}>Mark All Unpaid</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{rows.length} row(s)</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No sales found for this filter.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.rowKey} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.billText} numberOfLines={1}>
                    {row.billNo} · {row.itemCode}
                  </Text>
                  <Text style={styles.dateText}>{formatDate(row.billDate)}</Text>
                </View>
                <Text style={styles.sub}>
                  Qty {row.qty} · {row.employee ? row.employee.name : '(unassigned)'}
                  {!row.targetActive ? ' · Target closed' : ''}
                </Text>

                <View style={styles.payRow}>
                  <View style={styles.payCell}>
                    <Text style={styles.payLabel}>Employee: {money(row.employeeEarned)}</Text>
                    {row.employeeEarned > 0 &&
                      (row.employeePaid ? (
                        <Text style={styles.paidTag}>Paid</Text>
                      ) : (
                        <Pressable style={styles.payBtn} onPress={() => handleMark(row, 'Employee')} disabled={busyKey === `${row.rowKey}|Employee`}>
                          {busyKey === `${row.rowKey}|Employee` ? <ActivityIndicator size="small" color="#15803d" /> : <Text style={styles.payBtnText}>Mark Paid</Text>}
                        </Pressable>
                      ))}
                  </View>
                  <View style={styles.payCell}>
                    <Text style={styles.payLabel}>Manager: {money(row.managerEarned)}</Text>
                    {row.managerEarned > 0 &&
                      (row.managerPaid ? (
                        <Text style={styles.paidTag}>Paid</Text>
                      ) : (
                        <Pressable style={styles.payBtn} onPress={() => handleMark(row, 'Manager')} disabled={busyKey === `${row.rowKey}|Manager`}>
                          {busyKey === `${row.rowKey}|Manager` ? <ActivityIndicator size="small" color="#15803d" /> : <Text style={styles.payBtnText}>Mark Paid</Text>}
                        </Pressable>
                      ))}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), paddingTop: spacing(2) },
  searchInput: {
    marginHorizontal: spacing(2),
    marginTop: 8,
    height: 40,
    borderWidth: 1,
    borderColor: A.border,
    borderRadius: radius.sm,
    backgroundColor: A.surface,
    paddingHorizontal: 12,
    color: A.ink,
    fontSize: 13,
  },
  totalsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), marginTop: 10 },
  totalChip: { fontSize: 12, fontWeight: '700', color: A.ink, backgroundColor: A.surfaceRaised, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  bulkRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), marginTop: 10 },
  bulkBtn: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  bulkPay: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  bulkPayText: { color: '#15803d', fontWeight: '700', fontSize: 12 },
  bulkUnpay: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  bulkUnpayText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.card },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  billText: { flex: 1, fontSize: 13, fontWeight: '700', color: A.ink },
  dateText: { fontSize: 11, color: A.muted },
  sub: { fontSize: 11, color: A.muted, marginBottom: 8 },

  payRow: { flexDirection: 'row', gap: 10 },
  payCell: { flex: 1, gap: 4 },
  payLabel: { fontSize: 11.5, fontWeight: '600', color: A.ink },
  paidTag: { fontSize: 10.5, fontWeight: '700', color: '#15803d', backgroundColor: '#f0fdf4', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  payBtn: { alignSelf: 'flex-start', height: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5, borderColor: '#15803d', alignItems: 'center', justifyContent: 'center' },
  payBtnText: { color: '#15803d', fontWeight: '700', fontSize: 10.5 },
});
