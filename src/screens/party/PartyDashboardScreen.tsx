import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';
import DateField from '../../components/DateField';
import MiniChart, { ChartDatum } from '../../components/party/MiniChart';
import BalanceStockWidget from '../../components/party/BalanceStockWidget';
import FastMovingWidget from '../../components/party/FastMovingWidget';
import PurchaseMovementWidget from '../../components/party/PurchaseMovementWidget';
import {
  getDashboard,
  getDashboardLayout,
  saveDashboardLayout,
  DashboardResponse,
  ChartConfig,
  ChartKey,
  DashboardLayout,
} from '../../api/partyDashboardApi';

const P = colors.party;

const CHART_KEYS: ChartKey[] = ['day', 'category', 'size', 'color', 'department', 'session', 'mrp'];
const CHART_TITLES: Record<ChartKey, string> = {
  day: 'Day-wise',
  category: 'Category-wise',
  size: 'Size-wise',
  color: 'Color-wise',
  department: 'Department-wise',
  session: 'Session-wise',
  mrp: 'MRP-wise',
};
const DIM_FOR_CHART: Record<ChartKey, SelKey> = {
  day: 'dates',
  category: 'categories',
  size: 'sizes',
  color: 'colors',
  department: 'departments',
  session: 'sessions',
  mrp: 'mrps',
};
const DEFAULT_CONFIG: ChartConfig = { type: 'bar', metric: 'qty', visible: true };
function defaultChartConfigs(): Record<ChartKey, ChartConfig> {
  return {
    day: { ...DEFAULT_CONFIG },
    category: { ...DEFAULT_CONFIG },
    size: { ...DEFAULT_CONFIG },
    color: { ...DEFAULT_CONFIG },
    department: { ...DEFAULT_CONFIG },
    session: { ...DEFAULT_CONFIG },
    mrp: { ...DEFAULT_CONFIG },
  };
}

const PERIOD_OPTIONS = [
  { key: 'mtd', label: 'MTD' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'lastweek', label: 'Last Week' },
  { key: 'prevmonth', label: 'Prev Month' },
  { key: '3months', label: '3 Months' },
  { key: 'custom', label: 'Custom' },
];

type SelKey = 'categories' | 'sizes' | 'colors' | 'departments' | 'sessions' | 'mrps' | 'dates';
type SelState = Record<SelKey, string[]>;
const EMPTY_SEL: SelState = { categories: [], sizes: [], colors: [], departments: [], sessions: [], mrps: [], dates: [] };

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PartyDashboardScreen({ params }: { params?: { previewPartyId?: number } }) {
  // Set only when AdminShell opens this screen via PartyPanelListScreen's
  // "Preview" action (see requirePartyOrAdminPreview) — undefined for a real
  // Party session, which keeps every behavior below unchanged for them.
  const previewPartyId = params?.previewPartyId;
  const [periodMode, setPeriodMode] = useState('mtd');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [resolvedFrom, setResolvedFrom] = useState('');
  const [resolvedTo, setResolvedTo] = useState('');
  const [compareLY, setCompareLY] = useState(true);
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [brandOptions, setBrandOptions] = useState<{ id: number; name: string }[]>([]);
  const [globalMetric, setGlobalMetricState] = useState<'amount' | 'qty'>('qty');
  const [chartConfigs, setChartConfigs] = useState<Record<ChartKey, ChartConfig>>(defaultChartConfigs());
  const [sel, setSel] = useState<SelState>(EMPTY_SEL);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const layoutAppliedRef = useRef(false);

  const load = useCallback(
    async (shift?: 'prev' | 'next') => {
      setLoading(true);
      try {
        const res = await getDashboard({
          periodMode,
          from: periodMode === 'custom' ? customFrom || resolvedFrom || undefined : undefined,
          to: periodMode === 'custom' ? customTo || resolvedTo || undefined : undefined,
          shift,
          compareLY,
          brandId,
          selCategories: sel.categories,
          selSizes: sel.sizes,
          selColors: sel.colors,
          selDepartments: sel.departments,
          selSessions: sel.sessions,
          selMrps: sel.mrps,
          selDates: sel.dates,
        }, previewPartyId);
        setData(res.data);
        setResolvedFrom(res.data.from);
        setResolvedTo(res.data.to);
        setBrandOptions(res.data.brandOptions);
        if (brandId === undefined && res.data.activeBrandId != null) setBrandId(res.data.activeBrandId);
        if (res.data.periodMode !== periodMode) setPeriodMode(res.data.periodMode);
      } catch {
        Alert.alert('Could not load Dashboard');
      } finally {
        setLoading(false);
      }
    },
    [periodMode, customFrom, customTo, resolvedFrom, resolvedTo, compareLY, brandId, sel, previewPartyId]
  );

  // Apply a saved layout once on mount, then do the first load.
  useEffect(() => {
    (async () => {
      try {
        const res = await getDashboardLayout(previewPartyId);
        const layout = res.data.layout;
        if (layout) {
          if (layout.charts) setChartConfigs({ ...defaultChartConfigs(), ...layout.charts });
          if (layout.globalMetric) setGlobalMetricState(layout.globalMetric);
          if (layout.period?.mode) {
            setPeriodMode(layout.period.mode);
            if (layout.period.from) setCustomFrom(layout.period.from);
            if (layout.period.to) setCustomTo(layout.period.to);
          }
        }
      } catch {
        // No saved layout yet, or couldn't load — defaults are fine.
      } finally {
        layoutAppliedRef.current = true;
        load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!layoutAppliedRef.current) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMode, customFrom, customTo, compareLY, brandId, sel]);

  const toggleSel = (dim: SelKey, value: string) => {
    setSel((prev) => {
      const arr = prev[dim];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [dim]: next };
    });
  };
  const clearAllFilters = () => setSel(EMPTY_SEL);

  const setChartType = (key: ChartKey, type: ChartConfig['type']) => setChartConfigs((prev) => ({ ...prev, [key]: { ...prev[key], type } }));
  const setChartMetric = (key: ChartKey, metric: ChartConfig['metric']) => setChartConfigs((prev) => ({ ...prev, [key]: { ...prev[key], metric } }));
  const setChartVisible = (key: ChartKey, visible: boolean) => setChartConfigs((prev) => ({ ...prev, [key]: { ...prev[key], visible } }));
  const setGlobalMetric = (m: 'amount' | 'qty') => {
    setGlobalMetricState(m);
    setChartConfigs((prev) => {
      const next = { ...prev };
      for (const k of CHART_KEYS) next[k] = { ...next[k], metric: m };
      return next;
    });
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      const layout: DashboardLayout = {
        charts: chartConfigs,
        period: { mode: periodMode, from: periodMode === 'custom' ? resolvedFrom : undefined, to: periodMode === 'custom' ? resolvedTo : undefined },
        globalMetric,
      };
      await saveDashboardLayout(layout, previewPartyId);
      Alert.alert('Saved', 'Your dashboard layout has been saved.');
    } catch (err: any) {
      Alert.alert('Could not save layout', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetLayout = () => {
    setChartConfigs(defaultChartConfigs());
    setGlobalMetricState('qty');
    setCompareLY(true);
  };

  const summary = data?.summary;

  return (
    <View style={styles.screen}>
      {!!previewPartyId && (
        <View style={styles.previewBanner}>
          <Text style={styles.previewBannerText}>Admin Preview — read-only, viewing as this Party</Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing(2) }}>
        {PERIOD_OPTIONS.map((opt) => (
          <Pressable key={opt.key} style={[styles.periodChip, periodMode === opt.key && styles.periodChipActive]} onPress={() => setPeriodMode(opt.key)}>
            <Text style={[styles.periodChipText, periodMode === opt.key && styles.periodChipTextActive]}>{opt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {periodMode === 'custom' && (
        <View style={styles.customRow}>
          <View style={{ flex: 1 }}>
            <DateField label="From" granularity="day" value={customFrom} onChange={setCustomFrom} placeholder="Start date" />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="To" granularity="day" value={customTo} onChange={setCustomTo} placeholder="End date" />
          </View>
        </View>
      )}

      <View style={styles.rangeRow}>
        <Pressable style={styles.rangeNavBtn} onPress={() => load('prev')}>
          <Text style={styles.rangeNavText}>‹ Prev</Text>
        </Pressable>
        <Text style={styles.rangeText}>
          {resolvedFrom ? `${formatDate(resolvedFrom)} – ${formatDate(resolvedTo)}` : ''}
        </Text>
        <Pressable style={styles.rangeNavBtn} onPress={() => load('next')}>
          <Text style={styles.rangeNavText}>Next ›</Text>
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator size="large" color={P.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {data && (
            <>
              {brandOptions.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: spacing(1.5) }}>
                  {brandOptions.map((b) => (
                    <Pressable key={b.id} style={[styles.periodChip, brandId === b.id && styles.periodChipActive]} onPress={() => setBrandId(b.id)}>
                      <Text style={[styles.periodChipText, brandId === b.id && styles.periodChipTextActive]}>{b.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {!!data.scope.displayName && <Text style={styles.scopeText}>{data.scope.displayName}</Text>}

              {data.activeFilters.length > 0 && (
                <View style={styles.filterChipsRow}>
                  {data.activeFilters.flatMap((f) =>
                    f.values.map((v) => (
                      <Pressable key={`${f.dim}:${v}`} style={styles.filterChip} onPress={() => toggleSel(f.dim as SelKey, v)}>
                        <Text style={styles.filterChipText} numberOfLines={1}>
                          {v} ✕
                        </Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                    <Text style={styles.clearFiltersText}>Reset All Filters</Text>
                  </Pressable>
                </View>
              )}

              {summary && (
                <View style={styles.summaryGrid}>
                  <SummaryCard label="Bills" value={String(summary.billCount)} sub={summary.returnCount ? `${summary.returnCount} returns` : undefined} />
                  <SummaryCard label="Net Qty" value={String(summary.totQty)} />
                  <SummaryCard label="MRP" value={money(summary.totMrp)} />
                  <SummaryCard label="Disc Total" value={money(summary.totDisc)} />
                  <SummaryCard label="Net Amt" value={money(summary.totAmt)} sub={summary.calcCheck ? '✓' : '△'} />
                  <SummaryCard label="Avg Disc %" value={`${summary.avgDiscPct}%`} />
                  <SummaryCard label="ASP" value={money(summary.asp)} />
                  <SummaryCard label="Avg Bill Amt" value={money(summary.avgAmtPerBill)} />
                  <SummaryCard label="Avg Qty/Bill" value={String(summary.avgQtyPerBill)} />
                  {summary.hasReturns ? (
                    <>
                      <SummaryCard label="Return Qty" value={String(summary.totReturnQty)} />
                      <SummaryCard label="Returns" value={money(summary.totReturnAmt)} />
                    </>
                  ) : (
                    <SummaryCard label="Avg Disc" value={money(summary.avgDiscAmt)} />
                  )}
                  <SummaryCard label="Return Avg %" value={`${summary.returnAvgPct}%`} />
                </View>
              )}

              <View style={styles.globalControlsRow}>
                <View style={styles.metricToggle}>
                  {(['qty', 'amount'] as const).map((m) => (
                    <Pressable key={m} style={[styles.metricBtn, globalMetric === m && styles.metricBtnActive]} onPress={() => setGlobalMetric(m)}>
                      <Text style={[styles.metricBtnText, globalMetric === m && styles.metricBtnTextActive]}>{m === 'qty' ? 'Qty Wise' : 'Amount Wise'}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.lyRow}>
                  <Text style={styles.lyLabel}>Compare vs LY</Text>
                  <Switch value={compareLY} onValueChange={setCompareLY} trackColor={{ true: P.primary }} />
                </View>
              </View>

              {CHART_KEYS.map((key) => {
                const cfg = chartConfigs[key];
                if (!cfg.visible) return null;
                const entries = data.charts[key];
                const chartData: ChartDatum[] = entries.map((e) => ({
                  label: key === 'day' ? e.key || e.label : e.label,
                  displayLabel: e.label,
                  value: cfg.metric === 'amount' ? e.amount : e.qty,
                  lyValue: compareLY ? (cfg.metric === 'amount' ? e.lyAmount : e.lyQty) ?? null : null,
                }));
                const selectedSet = new Set(sel[DIM_FOR_CHART[key]]);

                return (
                  <View key={key} style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                      <Text style={styles.chartTitle}>{CHART_TITLES[key]}</Text>
                      <Switch value={cfg.visible} onValueChange={(v) => setChartVisible(key, v)} trackColor={{ true: P.primary }} />
                    </View>
                    <View style={styles.chartControlsRow}>
                      <View style={styles.smallToggle}>
                        {(['qty', 'amount'] as const).map((m) => (
                          <Pressable key={m} style={[styles.smallToggleBtn, cfg.metric === m && styles.smallToggleBtnActive]} onPress={() => setChartMetric(key, m)}>
                            <Text style={[styles.smallToggleText, cfg.metric === m && styles.smallToggleTextActive]}>{m === 'qty' ? 'Qty' : 'Amt'}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={styles.smallToggle}>
                        {(['bar', 'line', 'pie'] as const).map((t) => (
                          <Pressable key={t} style={[styles.smallToggleBtn, cfg.type === t && styles.smallToggleBtnActive]} onPress={() => setChartType(key, t)}>
                            <Text style={[styles.smallToggleText, cfg.type === t && styles.smallToggleTextActive]}>{t[0].toUpperCase() + t.slice(1)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <MiniChart data={chartData} type={cfg.type} showLY={compareLY} onSelect={(v) => toggleSel(DIM_FOR_CHART[key], v)} selectedLabels={selectedSet} />
                  </View>
                );
              })}

              <View style={{ marginBottom: spacing(2) }}>
                <BalanceStockWidget
                  filters={{
                    periodMode,
                    from: periodMode === 'custom' ? resolvedFrom : undefined,
                    to: periodMode === 'custom' ? resolvedTo : undefined,
                    brandId,
                    selCategories: sel.categories,
                    selSizes: sel.sizes,
                    selColors: sel.colors,
                  }}
                  previewPartyId={previewPartyId}
                />
              </View>

              <View style={{ marginBottom: spacing(2) }}>
                <FastMovingWidget brandId={brandId} previewPartyId={previewPartyId} />
              </View>

              <View style={{ marginBottom: spacing(2) }}>
                <PurchaseMovementWidget brandId={brandId} previewPartyId={previewPartyId} />
              </View>

              {/* Read-only in Admin Preview — the backend already 403s a layout
                  save while previewing (see partyDashboardController.js's
                  saveLayout), but the buttons are hidden here too so an admin
                  never sees a save action that can't actually do anything. */}
              {!previewPartyId && (
                <View style={styles.layoutBtnRow}>
                  <Pressable style={styles.resetBtn} onPress={handleResetLayout}>
                    <Text style={styles.resetBtnText}>Reset Layout</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={handleSaveLayout} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save My Dashboard Layout</Text>}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={styles.summaryValue}>{value}</Text>
        {sub && <Text style={styles.summarySub}>{sub}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2), paddingBottom: spacing(6) },

  previewBanner: { backgroundColor: '#fef3c7', paddingVertical: 8, paddingHorizontal: spacing(2), borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  previewBannerText: { fontSize: 11.5, fontWeight: '700', color: '#92400e', textAlign: 'center' },

  periodRow: { marginTop: spacing(1.5), flexGrow: 0 },
  periodChip: { height: 32, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  periodChipActive: { backgroundColor: P.primary, borderColor: P.primary },
  periodChipText: { fontSize: 11.5, fontWeight: '700', color: P.muted },
  periodChipTextActive: { color: '#fff' },

  customRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), marginTop: 8 },

  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing(2), marginTop: 10 },
  rangeNavBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface },
  rangeNavText: { fontSize: 11.5, fontWeight: '700', color: P.ink },
  rangeText: { fontSize: 12, fontWeight: '700', color: P.ink },

  scopeText: { fontSize: 12, color: P.muted, marginBottom: spacing(1), fontStyle: 'italic' },

  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing(2) },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: P.primary + '15', borderWidth: 1, borderColor: P.primary },
  filterChipText: { fontSize: 10.5, fontWeight: '700', color: P.primaryDark },
  clearFiltersBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' },
  clearFiltersText: { fontSize: 10.5, fontWeight: '700', color: '#b91c1c' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  summaryCard: { width: '31%', backgroundColor: P.surface, borderRadius: radius.sm, padding: 10, ...shadow.card },
  summaryLabel: { fontSize: 10, color: P.muted, fontWeight: '600', marginBottom: 2 },
  summaryValue: { fontSize: 13.5, fontWeight: '800', color: P.ink },
  summarySub: { fontSize: 10.5, color: P.green },

  globalControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  metricToggle: { flexDirection: 'row', backgroundColor: P.surfaceRaised, borderRadius: radius.sm, padding: 3 },
  metricBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm - 2 },
  metricBtnActive: { backgroundColor: P.primary },
  metricBtnText: { fontSize: 11, fontWeight: '700', color: P.muted },
  metricBtnTextActive: { color: '#fff' },
  lyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lyLabel: { fontSize: 11.5, fontWeight: '600', color: P.ink },

  chartCard: { backgroundColor: P.surface, borderRadius: radius.md, padding: 14, marginBottom: spacing(2), ...shadow.card },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  chartTitle: { fontSize: 13.5, fontWeight: '800', color: P.ink },
  chartControlsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  smallToggle: { flexDirection: 'row', backgroundColor: P.surfaceRaised, borderRadius: radius.sm, padding: 2 },
  smallToggleBtn: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.sm - 2 },
  smallToggleBtnActive: { backgroundColor: P.primary },
  smallToggleText: { fontSize: 10.5, fontWeight: '700', color: P.muted },
  smallToggleTextActive: { color: '#fff' },

  layoutBtnRow: { flexDirection: 'row', gap: 8, marginTop: spacing(1) },
  resetBtn: { flex: 1, height: 44, borderRadius: radius.sm, borderWidth: 1.5, borderColor: P.border, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface },
  resetBtnText: { fontSize: 12.5, fontWeight: '700', color: P.ink },
  saveBtn: { flex: 2, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: P.primary },
  saveBtnText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
});
