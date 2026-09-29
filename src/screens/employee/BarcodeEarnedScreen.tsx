import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import DateField from '../../components/DateField';
import Icon from '../../components/Icon';
import { colors, radius, spacing } from '../../theme';
import { BarcodeEarnedResponse, BarcodeEarnedRow, getBarcodeEarned } from '../../api/barcodeEarnedApi';

const E = colors.emp;

type RoleFilter = 'all' | 'Employee' | 'Manager';

function money(n: number) {
  return `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function fmtDay(key: string) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function sum(rows: BarcodeEarnedRow[], pick: (r: BarcodeEarnedRow) => number) {
  return rows.reduce((s, r) => s + pick(r), 0);
}

/**
 * Node/app port of Employee/BarcodeWiseEarned.aspx — the employee's Barcode
 * Target commission, date-wise (biggest days visible at a glance), tap a day
 * to see which barcodes were sold and whether each is Paid or Pending.
 * Manager rows show the team member who made the sale. Read-only.
 */
export default function BarcodeEarnedScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<BarcodeEarnedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<RoleFilter>('all');
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  const load = useCallback(async (f?: string, t?: string) => {
    try {
      const res = await getBarcodeEarned({ from: f || undefined, to: t || undefined });
      setData(res.data);
      setFrom(res.data.dateFrom);
      setTo(res.data.dateTo);
      // First (latest) day open by default, same as the web page.
      const first = res.data.rows[0]?.billDate;
      setOpenDays(new Set(first ? [first] : []));
    } catch (err: any) {
      Alert.alert('Could not load', err?.response?.data?.message || 'Please try again.');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const apply = async () => {
    setLoading(true);
    await load(from, to);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(from, to);
    setRefreshing(false);
  };

  const rows = useMemo(() => (data?.rows || []).filter((r) => role === 'all' || r.role === role), [data, role]);
  const days = useMemo(() => {
    const map = new Map<string, BarcodeEarnedRow[]>();
    for (const r of rows) {
      if (!map.has(r.billDate)) map.set(r.billDate, []);
      map.get(r.billDate)!.push(r);
    }
    return Array.from(map.entries()); // rows already arrive newest-date first
  }, [rows]);

  const total = sum(rows, (r) => r.earned);
  const paid = sum(rows.filter((r) => r.paid), (r) => r.earned);
  const showRoleFilter = !!data?.isEmployeeAnywhere && !!data?.isManagerAnywhere;

  const toggleDay = (key: string) =>
    setOpenDays((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  const notConfigured = data && !data.isEmployeeAnywhere && !data.isManagerAnywhere;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Card style={styles.card}>
        <View style={styles.filterRow}>
          <DateField label="From" granularity="day" value={from} onChange={setFrom} style={{ flex: 1 }} />
          <DateField label="To" granularity="day" value={to} onChange={setTo} style={{ flex: 1 }} />
        </View>
        <Button title="Apply" onPress={apply} loading={loading} />
      </Card>

      {notConfigured ? (
        <Card style={styles.card}>
          <Text style={styles.emptyText}>You're not on any Barcode Target yet — contact admin if you think this is a mistake.</Text>
        </Card>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <SummaryTile label="Earned" value={money(total)} color={E.primary} />
            <SummaryTile label="Paid" value={money(paid)} color={E.green} />
            <SummaryTile label="Pending" value={money(total - paid)} color={E.yellow} />
          </View>

          {showRoleFilter && (
            <View style={styles.roleRow}>
              {(['all', 'Employee', 'Manager'] as RoleFilter[]).map((r) => (
                <Pressable key={r} style={[styles.roleChip, role === r && styles.roleChipActive]} onPress={() => setRole(r)}>
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r === 'all' ? 'All' : `As ${r}`}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {days.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>No barcode sales in this date range.</Text>
            </Card>
          ) : (
            days.map(([day, dayRows]) => {
              const dayTotal = sum(dayRows, (r) => r.earned);
              const dayPaid = sum(dayRows.filter((r) => r.paid), (r) => r.earned);
              const open = openDays.has(day);
              return (
                <Card key={day} style={styles.dayCard}>
                  <Pressable style={styles.dayHead} onPress={() => toggleDay(day)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayTitle}>{fmtDay(day)}</Text>
                      <Text style={styles.dayMeta}>
                        {dayRows.length} barcode{dayRows.length === 1 ? '' : 's'} · {sum(dayRows, (r) => r.qty)} pcs
                        {dayPaid > 0 && dayPaid < dayTotal ? ` · ${money(dayPaid)} paid` : ''}
                      </Text>
                    </View>
                    <Text style={styles.dayAmount}>{money(dayTotal)}</Text>
                    <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                      <Icon name="chevronDown" size={18} color={E.muted} />
                    </View>
                  </Pressable>

                  {open &&
                    dayRows.map((r, i) => (
                      <View key={`${r.targetId}|${r.billNo}|${r.itemCode}|${r.role}|${i}`} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {r.articleNo || r.itemCode}
                            {r.brand ? ` · ${r.brand}` : ''}
                          </Text>
                          <Text style={styles.itemMeta} numberOfLines={2}>
                            {[r.color, r.size ? `Size ${r.size}` : '', `Bill ${r.billNo}`, `Barcode ${r.itemCode}`].filter(Boolean).join(' · ')}
                          </Text>
                          {r.role === 'Manager' && <Text style={styles.itemMeta}>Team sale by {r.soldBy}</Text>}
                          <View style={styles.badgeRow}>
                            <Text style={[styles.badge, r.role === 'Manager' ? styles.badgeMgr : styles.badgeEmp]}>{r.role}</Text>
                            <Text style={[styles.badge, r.paid ? styles.badgePaid : styles.badgePending]}>
                              {r.paid ? `Paid${r.paidDate ? ` ${new Date(r.paidDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}` : 'Pending'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.itemAmount}>{money(r.earned)}</Text>
                          <Text style={styles.itemMeta}>
                            {r.qty} × {money(r.rate)}
                          </Text>
                        </View>
                      </View>
                    ))}
                </Card>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={styles.summaryTile}>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg },
  card: { marginBottom: spacing(2) },
  emptyText: { color: E.muted, fontSize: 13, textAlign: 'center' },
  filterRow: { flexDirection: 'row', gap: 10 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(2) },
  summaryTile: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: E.muted, fontWeight: '600', marginTop: 2 },

  roleRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(2) },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: E.border, backgroundColor: E.surface },
  roleChipActive: { backgroundColor: E.primary, borderColor: E.primary },
  roleChipText: { fontSize: 12, fontWeight: '700', color: E.muted },
  roleChipTextActive: { color: '#fff' },

  dayCard: { marginBottom: spacing(1.5), padding: 0, overflow: 'hidden' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dayTitle: { fontSize: 14, fontWeight: '800', color: E.ink },
  dayMeta: { fontSize: 11, color: E.muted, marginTop: 2 },
  dayAmount: { fontSize: 15, fontWeight: '800', color: E.green },

  itemRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: E.border, backgroundColor: E.surface2 },
  itemTitle: { fontSize: 12.5, fontWeight: '700', color: E.ink },
  itemMeta: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  itemAmount: { fontSize: 13, fontWeight: '800', color: E.ink },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  badge: { fontSize: 9.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  badgeEmp: { backgroundColor: '#e0e7ff', color: '#3730a3' },
  badgeMgr: { backgroundColor: '#f3e8ff', color: '#6b21a8' },
  badgePaid: { backgroundColor: '#dcfce7', color: '#15803d' },
  badgePending: { backgroundColor: '#fef3c7', color: '#b45309' },
});
