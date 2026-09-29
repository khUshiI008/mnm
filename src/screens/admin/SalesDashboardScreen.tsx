import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import { getSalesDashboard, SalesDashboardResponse, SalesGroupRow } from '../../api/adminSalesDashboardApi';

const A = colors.admin;

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function defaultFrom() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function defaultTo() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SalesDashboardScreen() {
  const [fromDt, setFromDt] = useState(defaultFrom());
  const [toDt, setToDt] = useState(defaultTo());
  const [data, setData] = useState<SalesDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const res = await getSalesDashboard(f, t);
      setData(res.data);
    } catch (err: any) {
      Alert.alert('Could not load Sales Dashboard', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(fromDt, toDt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.filterCard}>
        <View style={styles.filterRow}>
          <DateField label="From" granularity="day" value={fromDt} onChange={setFromDt} placeholder="Select date" style={styles.dateInput} />
          <DateField label="To" granularity="day" value={toDt} onChange={setToDt} placeholder="Select date" style={styles.dateInput} />
        </View>
        <Button title="Apply Filter" onPress={() => load(fromDt, toDt)} loading={loading} />
      </Card>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(4) }} />
      ) : !data || data.empty ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No transactions found for the selected period. Sync data from Sales Report first.</Text>
        </Card>
      ) : (
        <>
          <Text style={styles.filterMeta}>
            {data.summary?.lineItems.toLocaleString('en-IN')} records · {fromDt} to {toDt}
          </Text>

          <View style={styles.kpiGrid}>
            <KpiChip label="Net Revenue" value={money(data.kpis!.netRevenue)} />
            <KpiChip label="Gross Margin" value={`${data.kpis!.grossMarginPct}%`} tint={data.kpis!.grossMarginPct >= 20 ? '#16a34a' : '#e11d48'} />
            <KpiChip label="Units Sold" value={data.kpis!.units.toLocaleString('en-IN')} />
            <KpiChip label="Discount Rate" value={`${data.kpis!.discRatePct}%`} tint={data.kpis!.discRatePct > 15 ? '#e11d48' : A.ink} />
            <KpiChip label="COGS" value={money(data.kpis!.cogs)} />
            <KpiChip label="AOV" value={money(data.kpis!.aov)} />
            <KpiChip label="Transactions" value={data.kpis!.transactions.toLocaleString('en-IN')} />
          </View>

          <SectionCard title="Health Diagnostics">
            <Text style={styles.healthGroupLabel}>✓ Positive Indicators</Text>
            {data.health!.good.map((h, i) => (
              <Text key={i} style={styles.healthGood}>
                • {h}
              </Text>
            ))}
            <Text style={[styles.healthGroupLabel, { marginTop: spacing(1.5) }]}>⚠ Risk Indicators</Text>
            {data.health!.bad.map((h, i) => (
              <Text key={i} style={styles.healthBad}>
                • {h}
              </Text>
            ))}
          </SectionCard>

          <BreakdownSection title="By Department" rows={data.departments || []} />
          <BreakdownSection title="By Salesperson" rows={data.salespersons || []} />
          <BreakdownSection title="By Brand" rows={data.brands || []} />
        </>
      )}
    </ScrollView>
  );
}

function KpiChip({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.kpiChip}>
      <Text style={[styles.kpiValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function BreakdownSection({ title, rows }: { title: string; rows: SalesGroupRow[] }) {
  return (
    <SectionCard title={title}>
      {rows.length === 0 ? (
        <Text style={styles.emptyRowText}>No data.</Text>
      ) : (
        rows.map((r, i) => (
          <View key={i} style={styles.breakdownRow}>
            <Text style={styles.breakdownRank}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.breakdownName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.breakdownSub}>
                {r.units.toLocaleString('en-IN')} units · margin {r.margin}% · disc {r.discRate}%
              </Text>
            </View>
            <Text style={styles.breakdownNet}>{money(r.net)}</Text>
          </View>
        ))
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  filterCard: { marginBottom: spacing(2) },
  filterRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1 },
  filterMeta: { fontSize: 11, color: A.muted, marginBottom: spacing(1.5) },

  emptyCard: { marginTop: spacing(2) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  kpiChip: { width: '31%', backgroundColor: A.surface, borderRadius: radius.sm, padding: 10, ...shadow.card },
  kpiValue: { fontSize: 14, fontWeight: '800', color: A.ink },
  kpiLabel: { fontSize: 10, color: A.muted, marginTop: 2 },

  sectionCard: { marginBottom: spacing(2) },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: A.ink, marginBottom: spacing(1) },
  healthGroupLabel: { fontSize: 11, fontWeight: '800', color: A.muted, marginBottom: 4 },
  healthGood: { fontSize: 12, color: '#15803d', marginBottom: 4, lineHeight: 17 },
  healthBad: { fontSize: 12, color: '#b91c1c', marginBottom: 4, lineHeight: 17 },

  emptyRowText: { fontSize: 12, color: A.muted },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: A.border },
  breakdownRank: { width: 18, fontSize: 11, color: A.muted, fontWeight: '700' },
  breakdownName: { fontSize: 12.5, fontWeight: '700', color: A.ink },
  breakdownSub: { fontSize: 10.5, color: A.muted, marginTop: 2 },
  breakdownNet: { fontSize: 12.5, fontWeight: '800', color: A.primary },
});
