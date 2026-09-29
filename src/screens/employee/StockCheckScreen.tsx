import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import TrialGate from './TrialGate';
import { getStockCheckFilters, searchStock, FilterOption, StockRow } from '../../api/stockCheckApi';

const E = colors.emp;

function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return fmtDateISO(d);
}

export default function StockCheckScreen({ navigation }: any) {
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [branches, setBranches] = useState<FilterOption[]>([]);
  const [sessions, setSessions] = useState<FilterOption[]>([]);
  const [brandNames, setBrandNames] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [fromDt, setFromDt] = useState(defaultFrom());
  const [toDt, setToDt] = useState(fmtDateISO(new Date()));
  const [itemName, setItemName] = useState('');

  const [rows, setRows] = useState<StockRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trial, setTrial] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await getStockCheckFilters();
        setBranches(res.data.branches);
        setSessions(res.data.sessions);
        setBrandNames(res.data.brandNames);
        setSelectedBranchIds(new Set(res.data.branches.map((b) => b.id)));
        setSelectedSessionIds(new Set(res.data.sessions.map((s) => s.id)));
      } catch (err: any) {
        if (err?.response?.data?.code === 'TRIAL_PENDING') setTrial(true);
      } finally {
        setFiltersLoading(false);
      }
    })();
  }, []);

  const branchIdsParam = useMemo(() => Array.from(selectedBranchIds).join(','), [selectedBranchIds]);
  const sessionIdsParam = useMemo(() => Array.from(selectedSessionIds).join(','), [selectedSessionIds]);

  const runSearch = async (isRefresh?: boolean) => {
    const name = itemName.trim();
    if (!name) {
      setError('Please enter an item name or barcode to search.');
      setRows([]);
      setSearched(false);
      return;
    }
    setError(null);
    if (!isRefresh) setLoading(true);
    try {
      const res = await searchStock({ itemName: name, fromDt, toDt, branchIds: branchIdsParam, sessionIds: sessionIdsParam });
      if (!res.data.success) {
        setError(res.data.message || 'Could not fetch stock data.');
        setRows([]);
      } else {
        setRows(res.data.rows);
        setExpanded(new Set());
      }
      setSearched(true);
      setTrial(false);
    } catch (err: any) {
      if (err?.response?.data?.code === 'TRIAL_PENDING') {
        setTrial(true);
      } else {
        setError(err?.response?.data?.message || 'Could not fetch stock data. Please try again.');
        setRows([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (!searched) return;
    setRefreshing(true);
    runSearch(true);
  };

  const toggleBranch = (id: string) => {
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleExpand = (sr: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sr)) next.delete(sr);
      else next.add(sr);
      return next;
    });
  };

  if (trial) return <TrialGate navigation={navigation} />;

  if (filtersLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.brandInfoRow}>
        {brandNames.length === 0 ? (
          <View style={[styles.brandChip, styles.brandChipAll]}>
            <Text style={styles.brandChipAllText}>All brands</Text>
          </View>
        ) : (
          brandNames.map((b) => (
            <View key={b} style={styles.brandChip}>
              <Text style={styles.brandChipText}>{b}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={E.muted} />
        <TextInput
          style={styles.searchInput}
          value={itemName}
          onChangeText={setItemName}
          onSubmitEditing={() => runSearch()}
          placeholder="Article no. or barcode..."
          placeholderTextColor={E.muted}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Pressable style={styles.searchBtn} onPress={() => runSearch()}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <Pressable style={styles.filtersToggle} onPress={() => setFiltersOpen((v) => !v)}>
        <Text style={styles.filtersToggleText}>Filters (branches, session, date range)</Text>
        <Icon name={filtersOpen ? 'chevronDown' : 'chevronRight'} size={16} color={E.muted} />
      </Pressable>

      {filtersOpen && (
        <Card style={styles.filterCard}>
          <View style={styles.dateRow}>
            <DateField granularity="day" value={fromDt} onChange={setFromDt} placeholder="From" style={styles.dateFieldWrap} inputStyle={styles.dateInput} />
            <Text style={styles.customTo}>to</Text>
            <DateField granularity="day" value={toDt} onChange={setToDt} placeholder="To" style={styles.dateFieldWrap} inputStyle={styles.dateInput} />
          </View>

          {branches.length > 0 && (
            <>
              <Text style={styles.filterLabel}>BRANCHES</Text>
              <View style={styles.chipWrap}>
                {branches.map((b) => {
                  const active = selectedBranchIds.has(b.id);
                  return (
                    <Pressable key={b.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleBranch(b.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {b.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {sessions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: spacing(1.5) }]}>SESSIONS</Text>
              <View style={styles.chipWrap}>
                {sessions.map((s) => {
                  const active = selectedSessionIds.has(s.id);
                  return (
                    <Pressable key={s.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSession(s.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Card>
      )}

      {!!error && (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      {loading && (
        <ActivityIndicator size="large" color={E.primary} style={{ marginTop: spacing(4) }} />
      )}

      {!loading && searched && !error && (
        <Text style={styles.resultCount}>
          {rows.length} item{rows.length === 1 ? '' : 's'} found
        </Text>
      )}

      {!loading && !searched && !error && (
        <Card style={styles.hintCard}>
          <Text style={styles.hintText}>Search an item name or barcode above to check live stock across branches.</Text>
        </Card>
      )}

      {!loading &&
        rows.map((row) => (
          <StockRowCard key={row.sr} row={row} expanded={expanded.has(row.sr)} onToggle={() => toggleExpand(row.sr)} />
        ))}
    </ScrollView>
  );
}

function StockRowCard({ row, expanded, onToggle }: { row: StockRow; expanded: boolean; onToggle: () => void }) {
  const totalQBal = row.sizes.reduce((s, sz) => s + (parseFloat(sz.qBal) || 0), 0);
  return (
    <Card style={styles.itemCard}>
      <Pressable style={styles.itemHead} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>
            {row.itemName || '-'} {row.color ? `· ${row.color}` : ''}
          </Text>
          <Text style={styles.itemSub} numberOfLines={1}>
            {row.branch} · {[row.type, row.category].filter(Boolean).join(' / ')}
          </Text>
          <Text style={styles.itemDates}>
            {row.firstPurchase && row.lastPurchase ? `${row.firstPurchase} – ${row.lastPurchase}` : 'No purchase history'}
          </Text>
        </View>
        <View style={styles.itemBalWrap}>
          <Text style={styles.itemBalValue}>{totalQBal % 1 === 0 ? totalQBal : totalQBal.toFixed(2)}</Text>
          <Text style={styles.itemBalLabel}>in stock</Text>
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} color={E.muted} />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.sizeList}>
          {row.sizes.map((sz, i) => (
            <View key={i} style={styles.sizeRow}>
              <Text style={styles.sizeLabel}>{sz.size || '-'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <StatChip label="Open" value={sz.open} />
                <StatChip label="Purc" value={sz.purc} />
                <StatChip label="In" value={sz.stockIn} />
                <StatChip label="Out" value={sz.stockOut} />
                <StatChip label="PurcRet" value={sz.purcRet} />
                <StatChip label="Sale" value={sz.sale} />
                <StatChip label="SaleRet" value={sz.saleRet} />
                <StatChip label="Net" value={sz.netSale} />
                <StatChip label="Bal" value={sz.qBal} highlight />
                {sz.salePct != null && <StatChip label="Sale%" value={`${sz.salePct}%`} />}
                {!!sz.barcode && <StatChip label="Barcode" value={sz.barcode} />}
              </ScrollView>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.statChip, highlight && styles.statChipHighlight]}>
      <Text style={[styles.statChipValue, highlight && styles.statChipValueHighlight]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg },
  content: { padding: spacing(2), paddingBottom: spacing(6) },

  brandInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing(1.5) },
  brandChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: E.surface2, borderWidth: 1, borderColor: E.border },
  brandChipText: { fontSize: 10.5, fontWeight: '700', color: E.ink },
  brandChipAll: { backgroundColor: '#EEF2FF', borderColor: '#c7d2fe' },
  brandChipAllText: { fontSize: 10.5, fontWeight: '700', color: '#4338ca' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: E.surface,
    borderWidth: 1,
    borderColor: E.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    marginBottom: spacing(1),
    ...shadow.card,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 13, color: E.ink },
  searchBtn: { backgroundColor: E.primary, borderRadius: radius.sm - 2, paddingHorizontal: 14, paddingVertical: 8 },
  searchBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  filtersToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: spacing(1) },
  filtersToggleText: { fontSize: 12, fontWeight: '700', color: E.muted },

  filterCard: { marginBottom: spacing(2) },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing(1.5) },
  dateFieldWrap: { flex: 1, marginBottom: 0 },
  dateInput: {
    borderColor: E.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: E.surface2,
    minHeight: 0,
  },
  customTo: { fontSize: 12, color: E.muted },
  filterLabel: { fontSize: 10.5, fontWeight: '800', color: E.muted, letterSpacing: 0.5, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: E.surface2, borderWidth: 1, borderColor: E.border, maxWidth: 200 },
  chipActive: { backgroundColor: E.primary, borderColor: E.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: E.muted },
  chipTextActive: { color: '#fff' },

  errorCard: { backgroundColor: '#fef2f2', marginBottom: spacing(2) },
  errorText: { color: E.red, fontSize: 13, fontWeight: '600' },

  resultCount: { fontSize: 12, fontWeight: '700', color: E.muted, marginBottom: spacing(1) },

  hintCard: { marginBottom: spacing(2) },
  hintText: { color: E.muted, textAlign: 'center', fontSize: 13 },

  itemCard: { marginBottom: spacing(1.5), padding: 0, overflow: 'hidden' },
  itemHead: { flexDirection: 'row', alignItems: 'center', padding: spacing(2) },
  itemName: { fontSize: 13.5, fontWeight: '800', color: E.ink },
  itemSub: { fontSize: 11, color: E.muted, marginTop: 2 },
  itemDates: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  itemBalWrap: { alignItems: 'flex-end', marginLeft: spacing(1), gap: 2 },
  itemBalValue: { fontSize: 16, fontWeight: '800', color: E.primary },
  itemBalLabel: { fontSize: 9.5, color: E.muted },

  sizeList: { borderTopWidth: 1, borderTopColor: E.border, padding: spacing(1.5), gap: spacing(1.5) },
  sizeRow: { gap: 6 },
  sizeLabel: { fontSize: 11.5, fontWeight: '800', color: E.ink },

  statChip: { backgroundColor: E.surface2, borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  statChipHighlight: { backgroundColor: '#EEF2FF' },
  statChipValue: { fontSize: 12, fontWeight: '800', color: E.ink },
  statChipValueHighlight: { color: '#4338ca' },
  statChipLabel: { fontSize: 8.5, color: E.muted, marginTop: 1 },
});
