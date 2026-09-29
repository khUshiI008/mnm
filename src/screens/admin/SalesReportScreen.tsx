import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '../../components/AppPicker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  getSalesReportFilterOptions,
  getSalesReportGrid,
  syncSalesReport,
  SalesReportFilterOptions,
  SalesTransactionRow,
  SalesReportStats,
} from '../../api/adminSalesReportApi';

const A = colors.admin;

function money(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function formatDateTime(d: string | null) {
  return d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
function defaultFrom() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function defaultTo() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SalesReportScreen() {
  const [fromDt, setFromDt] = useState(defaultFrom());
  const [toDt, setToDt] = useState(defaultTo());
  const [salesPerson, setSalesPerson] = useState('');
  const [brand, setBrand] = useState('');
  const [branchId, setBranchId] = useState('');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [session, setSession] = useState('');

  const [options, setOptions] = useState<SalesReportFilterOptions | null>(null);
  const [rows, setRows] = useState<SalesTransactionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<SalesReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const filters = { fromDt, toDt, salesPerson: salesPerson || undefined, brand: brand || undefined, branchId: branchId || undefined, category: category || undefined, department: department || undefined, session: session || undefined };

  const loadOptions = useCallback(async () => {
    try {
      const res = await getSalesReportFilterOptions();
      setOptions(res.data);
    } catch {
      /* dropdowns stay empty if master data isn't synced yet — matches .NET's silent catch */
    }
  }, []);

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalesReportGrid(filters);
      setRows(res.data.rows);
      setTotalCount(res.data.totalCount);
      setStats(res.data.stats);
    } catch (err: any) {
      Alert.alert('Could not load data', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDt, toDt, salesPerson, brand, branchId, category, department, session]);

  useEffect(() => {
    loadOptions();
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!fromDt || !toDt) {
      Alert.alert('From Date and To Date are required to sync.');
      return;
    }
    setSyncing(true);
    try {
      const res = await syncSalesReport(filters);
      Alert.alert(res.data.success ? 'Sync complete' : 'Sync failed', res.data.message);
      await loadOptions();
      await loadGrid();
    } catch (err: any) {
      Alert.alert('Sync failed', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.filterCard}>
        <View style={styles.filterRow}>
          <DateField label="From" granularity="day" value={fromDt} onChange={setFromDt} placeholder="Select date" style={styles.dateInput} />
          <DateField label="To" granularity="day" value={toDt} onChange={setToDt} placeholder="Select date" style={styles.dateInput} />
        </View>

        <FilterPicker label="Salesperson" value={salesPerson} onChange={setSalesPerson} options={options?.salespersons || []} allLabel="All Salespersons" />
        <FilterPicker label="Brand" value={brand} onChange={setBrand} options={options?.brands || []} allLabel="All Brands" />
        <FilterPicker label="Branch" value={branchId} onChange={setBranchId} options={options?.branches || []} allLabel="All Branches" />
        <FilterPicker label="Category" value={category} onChange={setCategory} options={options?.categories || []} allLabel="All Categories" />
        <FilterPicker label="Department" value={department} onChange={setDepartment} options={options?.departments || []} allLabel="All Departments" />
        <FilterPicker label="Session" value={session} onChange={setSession} options={options?.sessions || []} allLabel="All Sessions" />

        <View style={styles.btnRow}>
          <Button title="Apply Filter" variant="outline" onPress={loadGrid} loading={loading} style={{ flex: 1 }} />
          <Button title="Sync from ZOrder" onPress={handleSync} loading={syncing} style={{ flex: 1 }} />
        </View>
      </Card>

      {stats && (
        <Card style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <StatChip label="Total Records" value={totalCount.toLocaleString('en-IN')} />
            <StatChip label="Net Amount" value={money(stats.netAmt)} />
            <StatChip label="MRP" value={money(stats.mrpVal)} />
            <StatChip label="Discount" value={money(stats.discount)} />
            <StatChip label="Branches" value={String(stats.branches)} />
            <StatChip label="Persons" value={String(stats.persons)} />
          </View>
          <Text style={styles.statsMeta}>
            Range: {formatDate(stats.minDt)} – {formatDate(stats.maxDt)} · Last synced: {formatDateTime(stats.syncedOn)}
          </Text>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(3) }} />
      ) : rows.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No transactions found. Set a date range and tap "Sync from ZOrder".</Text>
        </Card>
      ) : (
        <>
          <Text style={styles.showingText}>
            Showing {rows.length.toLocaleString('en-IN')} of {totalCount.toLocaleString('en-IN')} records
          </Text>
          {rows.map((r, i) => (
            <Card key={i} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowMemo}>{r.cashmemoNo}</Text>
                <Text style={styles.rowDate}>{formatDate(r.cashmemoDt)}</Text>
              </View>
              <Text style={styles.rowLine} numberOfLines={1}>
                {r.branchName} · {r.salesPersonName || '—'}
              </Text>
              <Text style={styles.rowLine} numberOfLines={1}>
                {r.brand} · {r.invDepartmentName} {r.invCategoryName ? `· ${r.invCategoryName}` : ''}
              </Text>
              {(r.articleNo || r.color || r.size) && (
                <Text style={styles.rowLine} numberOfLines={1}>
                  {[r.articleNo, r.color, r.size].filter(Boolean).join(' · ')}
                </Text>
              )}
              <View style={styles.rowBottom}>
                <Text style={styles.rowQty}>Qty: {r.quantity}</Text>
                <Text style={styles.rowMrp}>MRP {money(r.mrpValue)}</Text>
                <Text style={styles.rowDisc}>-{money(r.discountAmt)}</Text>
                <Text style={styles.rowNet}>{money(r.netAmount)}</Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function FilterPicker({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value} onValueChange={(v) => onChange(String(v))}>
          <Picker.Item label={`— ${allLabel} —`} value="" />
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  filterCard: { marginBottom: spacing(2) },
  filterRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1 },
  pickerLabel: { fontSize: 12, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },

  statsCard: { marginBottom: spacing(2) },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  statChip: { width: '31%', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 8 },
  statValue: { fontSize: 13, fontWeight: '800', color: A.ink },
  statLabel: { fontSize: 10, color: A.muted, marginTop: 2 },
  statsMeta: { fontSize: 10.5, color: A.muted },

  emptyCard: { marginTop: spacing(2) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center' },
  showingText: { fontSize: 11, color: A.muted, marginBottom: spacing(1) },

  rowCard: { marginBottom: 10, ...shadow.card },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowMemo: { fontSize: 12, fontWeight: '800', color: A.ink },
  rowDate: { fontSize: 11, color: A.muted },
  rowLine: { fontSize: 11.5, color: A.ink, marginBottom: 2 },
  rowBottom: { flexDirection: 'row', gap: 10, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: A.border, flexWrap: 'wrap' },
  rowQty: { fontSize: 11, color: A.muted },
  rowMrp: { fontSize: 11, color: A.muted },
  rowDisc: { fontSize: 11, color: '#e11d48' },
  rowNet: { fontSize: 12, fontWeight: '800', color: A.primary, marginLeft: 'auto' },
});
