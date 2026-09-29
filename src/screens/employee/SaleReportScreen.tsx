import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import TrialGate from './TrialGate';
import {
  getSaleReportScope,
  getSaleReport,
  SaleReportMode,
  SaleReportViewMode,
  SaleReportSortBy,
  SaleReportResponse,
  ScopeOption,
  BillRow,
} from '../../api/saleReportApi';

const E = colors.emp;

const PRESETS: { value: SaleReportMode; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'mtd', label: 'MTD' },
  { value: 'custom', label: 'Custom' },
];
const SORT_OPTIONS: { value: SaleReportSortBy; label: string; dayOnly?: boolean }[] = [
  { value: 'date_desc', label: 'Newest', dayOnly: true },
  { value: 'date_asc', label: 'Oldest', dayOnly: true },
  { value: 'bill', label: 'Bill No' },
  { value: 'amt_desc', label: 'Amt ↓' },
  { value: 'amt_asc', label: 'Amt ↑' },
  { value: 'qty_desc', label: 'Qty ↓' },
  { value: 'qty_asc', label: 'Qty ↑' },
];

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function qtyStr(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function currentWeekMonday(anchor: Date) {
  const diff = (anchor.getDay() + 6) % 7;
  const d = new Date(anchor);
  d.setDate(d.getDate() - diff);
  return d;
}
function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SaleReportScreen({ navigation }: any) {
  const [scopeLoading, setScopeLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [brandOptions, setBrandOptions] = useState<ScopeOption[]>([]);
  const [deptOptions, setDeptOptions] = useState<ScopeOption[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<number>>(new Set());
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<number>>(new Set());

  const [mode, setMode] = useState<SaleReportMode>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [viewMode, setViewMode] = useState<SaleReportViewMode>('day');
  const [sortBy, setSortBy] = useState<SaleReportSortBy>('date_desc');
  const [search, setSearch] = useState('');

  const [data, setData] = useState<SaleReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trial, setTrial] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const skipEffectRef = useRef(false);
  const searchRef = useRef('');
  searchRef.current = search;

  const brandIdsParam = useMemo(() => Array.from(selectedBrandIds).sort((a, b) => a - b).join(','), [selectedBrandIds]);
  const deptIdsParam = useMemo(() => Array.from(selectedDeptIds).sort((a, b) => a - b).join(','), [selectedDeptIds]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getSaleReportScope();
        setConfigured(res.data.configured);
        setBrandOptions(res.data.brands);
        setDeptOptions(res.data.departments);
        setSelectedBrandIds(new Set(res.data.brands.map((b) => b.id)));
        setSelectedDeptIds(new Set(res.data.departments.map((d) => d.id)));
      } catch (err: any) {
        if (err?.response?.data?.code === 'TRIAL_PENDING') setTrial(true);
      } finally {
        setScopeLoading(false);
      }
    })();
  }, []);

  const loadWithParams = useCallback(
    async (m: SaleReportMode, from?: string, to?: string, isRefresh?: boolean) => {
      try {
        const res = await getSaleReport({
          mode: m,
          from: m === 'custom' ? from : undefined,
          to: m === 'custom' ? to : undefined,
          viewMode,
          sortBy,
          search: searchRef.current || undefined,
          brandIds: brandOptions.length ? brandIdsParam : undefined,
          deptIds: deptOptions.length ? deptIdsParam : undefined,
        });
        setData(res.data);
        setExpandedDays(res.data.days?.length ? new Set([res.data.days[0].date]) : new Set());
        setTrial(false);
      } catch (err: any) {
        if (err?.response?.data?.code === 'TRIAL_PENDING') setTrial(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [viewMode, sortBy, brandIdsParam, deptIdsParam, brandOptions.length, deptOptions.length]
  );

  // Auto-reload whenever a preset/toggle/sort/scope-chip changes. Custom-range
  // typing does NOT go through here (editing text shouldn't fire a request per
  // keystroke) — that's applied explicitly via applyCustomRange()/shiftRange().
  useEffect(() => {
    if (configured !== true) return;
    if (skipEffectRef.current) {
      skipEffectRef.current = false;
      return;
    }
    if (mode === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    loadWithParams(mode, customFrom, customTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, mode, viewMode, sortBy, brandIdsParam, deptIdsParam]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWithParams(mode, customFrom, customTo, true);
  };

  const selectPreset = (m: SaleReportMode) => {
    if (m === 'custom') {
      const f = data?.from || fmtDateISO(currentWeekMonday(new Date()));
      const t = data?.to || fmtDateISO(new Date());
      setCustomFrom(f);
      setCustomTo(t);
      skipEffectRef.current = true;
      setMode('custom');
      setLoading(true);
      loadWithParams('custom', f, t);
      return;
    }
    setMode(m);
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    setLoading(true);
    loadWithParams('custom', customFrom, customTo);
  };

  const shiftRange = (direction: number) => {
    if (!data?.from || !data?.to) return;
    const from = new Date(`${data.from}T00:00:00`);
    const to = new Date(`${data.to}T00:00:00`);
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const shiftMs = direction * spanDays * 86400000;
    const newFrom = fmtDateISO(new Date(from.getTime() + shiftMs));
    const newTo = fmtDateISO(new Date(to.getTime() + shiftMs));
    setCustomFrom(newFrom);
    setCustomTo(newTo);
    skipEffectRef.current = true;
    setMode('custom');
    setLoading(true);
    loadWithParams('custom', newFrom, newTo);
  };

  const toggleBrand = (id: number) => {
    setSelectedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleDept = (id: number) => {
    setSelectedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const runSearch = () => {
    setLoading(true);
    loadWithParams(mode, customFrom, customTo);
  };

  if (trial) return <TrialGate navigation={navigation} />;

  if (scopeLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  if (!configured) {
    return (
      <View style={styles.center}>
        <Icon name="document" size={32} color={E.muted} />
        <Text style={styles.notConfiguredTitle}>Sale Report isn't set up yet</Text>
        <Text style={styles.notConfiguredBody}>
          Ask HR to allocate at least one Brand or Department to your profile to unlock this report.
        </Text>
      </View>
    );
  }

  const sortOptions = SORT_OPTIONS.filter((o) => !o.dayOnly || viewMode === 'day');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.periodRow}>
        <Pressable style={styles.periodArrow} onPress={() => shiftRange(-1)}>
          <Icon name="chevronLeft" size={18} color={E.ink} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.value}
              style={[styles.periodPill, mode === p.value && styles.periodPillActive]}
              onPress={() => selectPreset(p.value)}
            >
              <Text style={[styles.periodPillText, mode === p.value && styles.periodPillTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.periodArrow} onPress={() => shiftRange(1)}>
          <Icon name="chevronRight" size={18} color={E.ink} />
        </Pressable>
      </View>

      {!!data?.periodLabel && (
        <Text style={styles.periodLabel}>
          {data.periodLabel} · {data.from} to {data.to} ({data.spanDays} day{data.spanDays === 1 ? '' : 's'})
        </Text>
      )}

      {mode === 'custom' && (
        <Card style={styles.customCard}>
          <View style={styles.customRow}>
            <DateField granularity="day" value={customFrom} onChange={setCustomFrom} placeholder="From" style={styles.dateFieldWrap} inputStyle={styles.customInput} />
            <Text style={styles.customTo}>to</Text>
            <DateField granularity="day" value={customTo} onChange={setCustomTo} placeholder="To" style={styles.dateFieldWrap} inputStyle={styles.customInput} />
            <Pressable style={styles.customApplyBtn} onPress={applyCustomRange}>
              <Icon name="check" size={16} color="#fff" />
            </Pressable>
          </View>
        </Card>
      )}

      {(brandOptions.length > 0 || deptOptions.length > 0) && (
        <Card style={styles.filterCard}>
          {brandOptions.length > 0 && (
            <>
              <Text style={styles.filterLabel}>BRANDS</Text>
              <View style={styles.chipWrap}>
                {brandOptions.map((b) => {
                  const active = selectedBrandIds.has(b.id);
                  return (
                    <Pressable key={b.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleBrand(b.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {deptOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, brandOptions.length > 0 && { marginTop: spacing(1.5) }]}>DEPARTMENTS</Text>
              <View style={styles.chipWrap}>
                {deptOptions.map((d) => {
                  const active = selectedDeptIds.has(d.id);
                  return (
                    <Pressable key={d.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleDept(d.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Card>
      )}

      <View style={styles.toolRow}>
        <View style={styles.viewToggle}>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'day' && styles.viewToggleBtnActive]} onPress={() => setViewMode('day')}>
            <Text style={[styles.viewToggleText, viewMode === 'day' && styles.viewToggleTextActive]}>Day-wise</Text>
          </Pressable>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'item' && styles.viewToggleBtnActive]} onPress={() => setViewMode('item')}>
            <Text style={[styles.viewToggleText, viewMode === 'item' && styles.viewToggleTextActive]}>Item-wise</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: spacing(1.5) }}>
        {sortOptions.map((o) => (
          <Pressable
            key={o.value}
            style={[styles.sortChip, sortBy === o.value && styles.sortChipActive]}
            onPress={() => setSortBy(o.value)}
          >
            <Text style={[styles.sortChipText, sortBy === o.value && styles.sortChipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={E.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={runSearch}
          placeholder="Search bill no, article, category, color..."
          placeholderTextColor={E.muted}
          returnKeyType="search"
        />
      </View>

      {loading && !data ? (
        <ActivityIndicator size="large" color={E.primary} style={{ marginTop: spacing(4) }} />
      ) : data?.summary ? (
        <SummaryStrip summary={data.summary} />
      ) : null}

      {!loading && data && !data.summary && (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sales found for this range and filter selection.</Text>
        </Card>
      )}

      {viewMode === 'day' &&
        data?.days?.map((day) => (
          <DayCard key={day.date} day={day} expanded={expandedDays.has(day.date)} onToggle={() => toggleDay(day.date)} />
        ))}

      {viewMode === 'item' && data?.items?.map((it, idx) => <ItemRowCard key={idx} item={it} />)}
    </ScrollView>
  );
}

function SummaryStrip({ summary }: { summary: NonNullable<SaleReportResponse['summary']> }) {
  return (
    <View style={styles.summaryRow}>
      <SummaryStat
        label="Bills"
        value={`${summary.billCount}${summary.returnRowCount > 0 ? ` (${summary.returnRowCount} ret)` : ''}`}
      />
      <SummaryStat label="Net Qty" value={qtyStr(summary.totQty)} tint={E.primary} />
      <SummaryStat
        label="Net Amt"
        value={money(summary.totAmt)}
        tint={E.green}
        badge={summary.calcCheck ? '✓' : '△'}
        badgeTint={summary.calcCheck ? E.green : E.yellow}
      />
      <SummaryStat label="MRP (sales)" value={money(summary.totMrp)} />
      <SummaryStat label="Disc Total" value={`-${money(summary.totDisc)}`} tint={E.red} />
      {summary.returnRowCount > 0 ? (
        <>
          <SummaryStat label="Return Qty" value={qtyStr(summary.totReturnQty)} tint={E.red} />
          <SummaryStat label="Returns" value={money(summary.totReturnAmt)} tint={E.red} />
        </>
      ) : (
        <SummaryStat label="Avg Disc" value={`-${money(summary.avgDiscAmt)}`} tint={E.yellow} />
      )}
      <SummaryStat label="Avg Disc %" value={`${summary.avgDiscPct}%`} tint={E.yellow} />
    </View>
  );
}

function SummaryStat({ label, value, tint, badge, badgeTint }: { label: string; value: string; tint?: string; badge?: string; badgeTint?: string }) {
  return (
    <View style={styles.summaryStat}>
      <View style={styles.summaryStatValueRow}>
        <Text style={[styles.summaryStatValue, tint && { color: tint }]}>{value}</Text>
        {badge ? <Text style={[styles.summaryBadge, { color: badgeTint }]}>{badge}</Text> : null}
      </View>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

function DayCard({ day, expanded, onToggle }: { day: NonNullable<SaleReportResponse['days']>[number]; expanded: boolean; onToggle: () => void }) {
  return (
    <Card style={styles.dayCard}>
      <Pressable style={styles.dayHead} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayDate}>{dayLabel(day.date)}</Text>
          <Text style={styles.dayMeta}>
            {day.billCount} bill{day.billCount === 1 ? '' : 's'} · {qtyStr(day.qty)} qty · {money(day.amt)}
          </Text>
        </View>
        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={18} color={E.muted} />
      </Pressable>
      {expanded && (
        <View style={styles.billList}>
          {day.bills.map((b, idx) => (
            <BillRowItem key={idx} bill={b} />
          ))}
        </View>
      )}
    </Card>
  );
}

function BillRowItem({ bill }: { bill: BillRow }) {
  const discPct = bill.mrp > 0 && bill.discount > 0 ? Math.round((bill.discount / bill.mrp) * 1000) / 10 : null;
  return (
    <View style={[styles.billRow, bill.isReturn && styles.billRowReturn]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.billNo}>
          #{bill.billNo || '?'} <Text style={styles.billTime}>{bill.timeStr}</Text>
          {bill.isReturn && <Text style={styles.billReturnTag}> RETURN</Text>}
        </Text>
        <Text style={styles.billArticle} numberOfLines={1}>
          {bill.article || '-'}
          {bill.color || bill.size ? ` · ${[bill.color, bill.size].filter(Boolean).join(' / ')}` : ''}
        </Text>
        <Text style={styles.billSub} numberOfLines={1}>
          {[bill.brand, bill.dept, bill.category].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.billRight}>
        <Text style={[styles.billQty, bill.isReturn && styles.billReturnText]}>{qtyStr(bill.qty)} pc</Text>
        <Text style={styles.billMrp}>{money(bill.mrp)}</Text>
        {bill.discount > 0 && !bill.isReturn ? (
          <Text style={styles.billDisc}>
            -{money(bill.discount)} {discPct != null ? `(${discPct}%)` : ''}
          </Text>
        ) : null}
        <Text style={[styles.billAmt, bill.isReturn && styles.billReturnText]}>{money(bill.amount)}</Text>
      </View>
    </View>
  );
}

function ItemRowCard({ item }: { item: NonNullable<SaleReportResponse['items']>[number] }) {
  const isNetReturn = item.qty < 0;
  return (
    <Card style={styles.itemCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.billArticle} numberOfLines={1}>
          {item.article || '-'}
          {item.color || item.size ? ` · ${[item.color, item.size].filter(Boolean).join(' / ')}` : ''}
        </Text>
        <Text style={styles.billSub} numberOfLines={1}>
          {[item.brand, item.dept, item.category].filter(Boolean).join(' · ')} · {item.billCount} bill{item.billCount === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={styles.billRight}>
        <Text style={[styles.billQty, isNetReturn && styles.billReturnText]}>{qtyStr(item.qty)} pc</Text>
        <Text style={styles.billMrp}>{money(item.mrpTotal)}</Text>
        {item.discTotal > 0 ? <Text style={styles.billDisc}>-{money(item.discTotal)}</Text> : null}
        <Text style={[styles.billAmt, isNetReturn && styles.billReturnText]}>{money(item.amtTotal)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg, padding: spacing(3) },
  content: { padding: spacing(2), paddingBottom: spacing(6) },

  notConfiguredTitle: { fontSize: 16, fontWeight: '800', color: E.ink, marginTop: spacing(1.5), textAlign: 'center' },
  notConfiguredBody: { fontSize: 13, color: E.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  periodArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: E.surface,
    borderWidth: 1,
    borderColor: E.border,
  },
  periodPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: E.surface, borderWidth: 1, borderColor: E.border },
  periodPillActive: { backgroundColor: E.primary, borderColor: E.primary },
  periodPillText: { fontSize: 12, fontWeight: '700', color: E.muted },
  periodPillTextActive: { color: '#fff' },
  periodLabel: { textAlign: 'center', fontSize: 12, color: E.muted, marginBottom: spacing(1.5), fontWeight: '600' },

  customCard: { marginBottom: spacing(1.5) },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateFieldWrap: { flex: 1, marginBottom: 0 },
  customInput: {
    borderColor: E.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: E.surface2,
    minHeight: 0,
  },
  customTo: { fontSize: 12, color: E.muted },
  customApplyBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: E.primary, alignItems: 'center', justifyContent: 'center' },

  filterCard: { marginBottom: spacing(1.5) },
  filterLabel: { fontSize: 10.5, fontWeight: '800', color: E.muted, letterSpacing: 0.5, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: E.surface2, borderWidth: 1, borderColor: E.border },
  chipActive: { backgroundColor: E.primary, borderColor: E.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: E.muted },
  chipTextActive: { color: '#fff' },

  toolRow: { flexDirection: 'row', marginBottom: spacing(1) },
  viewToggle: { flexDirection: 'row', backgroundColor: E.surface2, borderRadius: radius.sm, padding: 3, gap: 3, flex: 1 },
  viewToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm - 2, alignItems: 'center' },
  viewToggleBtnActive: { backgroundColor: E.primary },
  viewToggleText: { fontSize: 12, fontWeight: '700', color: E.muted },
  viewToggleTextActive: { color: '#fff' },

  sortChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: E.surface, borderWidth: 1, borderColor: E.border },
  sortChipActive: { backgroundColor: E.ink, borderColor: E.ink },
  sortChipText: { fontSize: 11, fontWeight: '700', color: E.muted },
  sortChipTextActive: { color: '#fff' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: E.surface,
    borderWidth: 1,
    borderColor: E.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    marginBottom: spacing(2),
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: E.ink },

  emptyCard: { marginBottom: spacing(2) },
  emptyText: { color: E.muted, textAlign: 'center', fontSize: 13 },

  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  summaryStat: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: E.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: E.border,
    padding: 10,
  },
  summaryStatValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryStatValue: { fontSize: 14, fontWeight: '800', color: E.ink },
  summaryBadge: { fontSize: 12, fontWeight: '800' },
  summaryStatLabel: { fontSize: 10, color: E.muted, marginTop: 2 },

  dayCard: { marginBottom: spacing(1.5), padding: 0, overflow: 'hidden', ...shadow.card },
  dayHead: { flexDirection: 'row', alignItems: 'center', padding: spacing(2) },
  dayDate: { fontSize: 13.5, fontWeight: '800', color: E.ink },
  dayMeta: { fontSize: 11.5, color: E.muted, marginTop: 2 },
  billList: { borderTopWidth: 1, borderTopColor: E.border },

  billRow: { flexDirection: 'row', padding: spacing(1.5), borderBottomWidth: 1, borderBottomColor: E.border, gap: 10 },
  billRowReturn: { backgroundColor: '#fef2f2' },
  billNo: { fontSize: 11.5, fontWeight: '800', color: E.ink },
  billTime: { fontSize: 10.5, fontWeight: '600', color: E.muted },
  billReturnTag: { fontSize: 9.5, fontWeight: '800', color: E.red },
  billArticle: { fontSize: 12.5, fontWeight: '700', color: E.ink, marginTop: 3 },
  billSub: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  billRight: { alignItems: 'flex-end', minWidth: 78 },
  billQty: { fontSize: 11, fontWeight: '700', color: E.ink },
  billMrp: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  billDisc: { fontSize: 10.5, color: E.red, marginTop: 2 },
  billAmt: { fontSize: 13, fontWeight: '800', color: E.ink, marginTop: 3 },
  billReturnText: { color: E.red },

  itemCard: { flexDirection: 'row', marginBottom: spacing(1.5), alignItems: 'center' },
});
