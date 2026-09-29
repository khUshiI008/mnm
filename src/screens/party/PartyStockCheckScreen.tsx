import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import DateField from '../../components/DateField';
import { colors, radius, shadow, spacing } from '../../theme';
import { getStockCheckFilters, searchStock, FilterOption, BrandOption, StockRow, SizeRow } from '../../api/partyStockCheckApi';

const P = colors.party;

function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultFrom() {
  return '2025-09-01';
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV line per Branch+Article+Color+Size — same column set as StockCheck.aspx.cs's btnExportExcel_Click. */
function buildStockCsv(rows: StockRow[]): string {
  const headers = [
    'Branch', 'Item Name', 'Color', 'Type', 'Category', 'First Purchase', 'Last Purchase',
    'Size', 'Open', 'Purc', 'Stock In', 'Stock Out', 'PurcRet', 'Sale', 'SaleRet', 'NetSale', 'Bal', 'Sale %', 'Barcode',
  ];
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) {
    for (const sz of r.sizes) {
      lines.push(
        [
          r.branch, r.itemName, r.color, r.type, r.category, r.firstPurchase, r.lastPurchase,
          sz.size, sz.open, sz.purc, sz.stockIn, sz.stockOut, sz.purcRet, sz.sale, sz.saleRet, sz.netSale, sz.qBal,
          sz.salePct != null ? `${sz.salePct}%` : '', sz.barcode,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }
  return lines.join('\r\n');
}

/** Per-item Totals row -- sums all 9 size-level metrics + recomputes total Sale% with the same formula BuildDetailHtml uses (NOT an average of the per-size percentages). */
function computeSizeTotals(sizes: SizeRow[]) {
  const sum = (key: keyof SizeRow) => sizes.reduce((s, sz) => s + (parseFloat(String(sz[key])) || 0), 0);
  const open = sum('open');
  const purc = sum('purc');
  const stockIn = sum('stockIn');
  const stockOut = sum('stockOut');
  const purcRet = sum('purcRet');
  const sale = sum('sale');
  const saleRet = sum('saleRet');
  const netSale = sum('netSale');
  const qBal = sum('qBal');
  const totalPurchase = open + purc + stockIn - purcRet - stockOut;
  const totalSale = sale - saleRet;
  const salePct = totalPurchase !== 0 ? Math.round(((totalSale * 100) / totalPurchase) * 100) / 100 : null;
  return { open, purc, stockIn, stockOut, purcRet, sale, saleRet, netSale, qBal, salePct };
}

function fmtTotal(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/** Node port of Party/StockCheck.aspx — live stock-ledger lookup via the shared salesApiService.getVendorReport client. */
export default function PartyStockCheckScreen() {
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [branches, setBranches] = useState<FilterOption[]>([]);
  const [sessions, setSessions] = useState<FilterOption[]>([]);
  const [scopeName, setScopeName] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Brand checklist (StockCheck.aspx.cs's cblBrands) -- brandOptions is left
  // empty by the server when this Party is masked (hideBrandName), in which
  // case extraDescOptions carries the read-only labels shown instead. See
  // partyStockCheckService.js's getFilterOptions doc comment for the full
  // privacy rationale.
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [hideBrandName, setHideBrandName] = useState(false);
  const [extraDescOptions, setExtraDescOptions] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const [fromDt, setFromDt] = useState(defaultFrom());
  const [toDt, setToDt] = useState(fmtDateISO(new Date()));
  const [itemName, setItemName] = useState('');

  const [rows, setRows] = useState<StockRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await getStockCheckFilters();
        setBranches(res.data.branches);
        setSessions(res.data.sessions);
        setScopeName(res.data.scope.displayName);
        setSelectedBranchIds(new Set(res.data.branches.map((b) => b.id)));
        setSelectedSessionIds(new Set(res.data.sessions.map((s) => s.id)));
        setBrandOptions(res.data.brandOptions);
        setHideBrandName(res.data.scope.hideBrandName);
        setExtraDescOptions(res.data.extraDescOptions);
        setSelectedBrandIds(new Set(res.data.brandOptions.map((b) => b.id)));
      } catch {
        // Filter lists failing to load isn't fatal — search still works with no branch/session narrowing.
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
    // Same early-return as StockCheck.aspx.cs's RunSearch when every Brand
    // checkbox is unchecked -- never silently fall back to "unrestricted",
    // which would widen results beyond this Party's own allocation.
    if (brandOptions.length > 0 && selectedBrandIds.size === 0) {
      setError('Select at least one Brand, or leave them all checked.');
      setRows([]);
      setSearched(false);
      return;
    }
    setError(null);
    if (!isRefresh) setLoading(true);
    try {
      const res = await searchStock({
        itemName: name,
        fromDt,
        toDt,
        branchIds: branchIdsParam,
        sessionIds: sessionIdsParam,
        brandIds: brandOptions.length > 0 ? Array.from(selectedBrandIds) : undefined,
      });
      if (!res.data.success) {
        setError(res.data.message || 'Could not fetch stock data.');
        setRows([]);
      } else {
        setRows(res.data.rows);
        setExpanded(new Set());
      }
      setSearched(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not fetch stock data. Please try again.');
      setRows([]);
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
  const toggleBrand = (id: number) => {
    setSelectedBrandIds((prev) => {
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

  // Node/mobile equivalent of StockCheck.aspx.cs's btnExportExcel_Click --
  // that writes an HTML-table-as-.xls response; here a CSV (opens fine in
  // Excel, no native Excel-writing library needed) is written to a local
  // cache file via react-native-blob-util and handed to the native share
  // sheet via react-native-share -- both already app dependencies (see
  // src/utils/shareMedia.ts for the same download-then-share idiom this
  // mirrors). Exports exactly the rows currently on screen (one line per
  // Branch+Article+Color+Size), same "matches whatever's on screen" contract
  // as the .NET reference's re-run-the-search-then-export approach.
  const onExport = async () => {
    if (!rows.length || exporting) return;
    setExporting(true);
    try {
      const csv = buildStockCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `StockCheck_${stamp}_${Date.now()}.csv`;
      const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await ReactNativeBlobUtil.fs.writeFile(path, csv, 'utf8');
      await Share.open({ url: `file://${path}`, filename, type: 'text/csv', failOnCancel: false });
    } catch (err: any) {
      if (err?.message && !/user did not share/i.test(err.message)) {
        Alert.alert('Export failed', 'Could not export stock data. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  };

  if (filtersLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {!!scopeName && (
        <View style={styles.brandInfoRow}>
          <View style={styles.brandChip}>
            <Text style={styles.brandChipText}>{scopeName}</Text>
          </View>
        </View>
      )}

      <View style={styles.searchRow}>
        <Icon name="search" size={16} color={P.muted} />
        <TextInput
          style={styles.searchInput}
          value={itemName}
          onChangeText={setItemName}
          onSubmitEditing={() => runSearch()}
          placeholder="Article no. or barcode..."
          placeholderTextColor={P.muted}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Pressable style={styles.searchBtn} onPress={() => runSearch()}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <Pressable style={styles.filtersToggle} onPress={() => setFiltersOpen((v) => !v)}>
        <Text style={styles.filtersToggleText}>Filters (branches, session, brand, date range)</Text>
        <Icon name={filtersOpen ? 'chevronDown' : 'chevronRight'} size={16} color={P.muted} />
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

          {/* Brand checklist -- StockCheck.aspx.cs's cblBrands, default all-checked.
              Hidden entirely in favor of read-only Extra Description chips when this
              Party is masked (hideBrandName) -- the server never even sends real
              Brand names in that case, see partyStockCheckService.js. */}
          {!hideBrandName && brandOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: spacing(1.5) }]}>BRAND</Text>
              <View style={styles.chipWrap}>
                {brandOptions.map((b) => {
                  const active = selectedBrandIds.has(b.id);
                  return (
                    <Pressable key={b.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleBrand(b.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {b.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {hideBrandName && extraDescOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: spacing(1.5) }]}>BRAND</Text>
              <View style={styles.chipWrap}>
                {extraDescOptions.map((d) => (
                  <View key={d} style={styles.brandChip}>
                    <Text style={styles.brandChipText} numberOfLines={1}>
                      {d}
                    </Text>
                  </View>
                ))}
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

      {loading && <ActivityIndicator size="large" color={P.primary} style={{ marginTop: spacing(4) }} />}

      {!loading && searched && !error && (
        <View style={styles.resultHeaderRow}>
          <Text style={styles.resultCount}>
            {rows.length} item{rows.length === 1 ? '' : 's'} found
          </Text>
          {rows.length > 0 && (
            <Pressable style={styles.exportBtn} onPress={onExport} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator size="small" color={P.primary} />
              ) : (
                <Icon name="share" size={13} color={P.primary} />
              )}
              <Text style={styles.exportBtnText}>Export</Text>
            </Pressable>
          )}
        </View>
      )}

      {!loading && !searched && !error && (
        <Card style={styles.hintCard}>
          <Text style={styles.hintText}>Search an item name or barcode above to check live stock across branches.</Text>
        </Card>
      )}

      {!loading && rows.map((row) => <StockRowCard key={row.sr} row={row} expanded={expanded.has(row.sr)} onToggle={() => toggleExpand(row.sr)} />)}
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
          <Text style={styles.itemDates}>{row.firstPurchase && row.lastPurchase ? `${row.firstPurchase} – ${row.lastPurchase}` : 'No purchase history'}</Text>
        </View>
        <View style={styles.itemBalWrap}>
          <Text style={styles.itemBalValue}>{totalQBal % 1 === 0 ? totalQBal : totalQBal.toFixed(2)}</Text>
          <Text style={styles.itemBalLabel}>in stock</Text>
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} color={P.muted} />
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

          {/* Per-item Totals row -- mirrors StockCheck.aspx.cs's BuildDetailHtml,
              which sums all 9 metrics across every size row for this item and
              recomputes a single total Sale% (NOT an average of the per-size
              percentages). Visually distinguished (bold, filled chips) from the
              individual size rows above. */}
          {row.sizes.length > 0 &&
            (() => {
              const t = computeSizeTotals(row.sizes);
              return (
                <View style={[styles.sizeRow, styles.totalsRow]}>
                  <Text style={styles.totalsLabel}>TOTAL</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <StatChip label="Open" value={fmtTotal(t.open)} strong />
                    <StatChip label="Purc" value={fmtTotal(t.purc)} strong />
                    <StatChip label="In" value={fmtTotal(t.stockIn)} strong />
                    <StatChip label="Out" value={fmtTotal(t.stockOut)} strong />
                    <StatChip label="PurcRet" value={fmtTotal(t.purcRet)} strong />
                    <StatChip label="Sale" value={fmtTotal(t.sale)} strong />
                    <StatChip label="SaleRet" value={fmtTotal(t.saleRet)} strong />
                    <StatChip label="Net" value={fmtTotal(t.netSale)} strong />
                    <StatChip label="Bal" value={fmtTotal(t.qBal)} strong />
                    {t.salePct != null && <StatChip label="Sale%" value={`${t.salePct}%`} strong />}
                  </ScrollView>
                </View>
              );
            })()}
        </View>
      )}
    </Card>
  );
}

function StatChip({ label, value, highlight, strong }: { label: string; value: string; highlight?: boolean; strong?: boolean }) {
  return (
    <View style={[styles.statChip, highlight && styles.statChipHighlight, strong && styles.statChipStrong]}>
      <Text style={[styles.statChipValue, highlight && styles.statChipValueHighlight, strong && styles.statChipValueStrong]}>{value}</Text>
      <Text style={[styles.statChipLabel, strong && styles.statChipLabelStrong]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  content: { padding: spacing(2), paddingBottom: spacing(6) },

  brandInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing(1.5) },
  brandChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: P.surfaceRaised, borderWidth: 1, borderColor: P.border },
  brandChipText: { fontSize: 10.5, fontWeight: '700', color: P.ink },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    marginBottom: spacing(1),
    ...shadow.card,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 13, color: P.ink },
  searchBtn: { backgroundColor: P.primary, borderRadius: radius.sm - 2, paddingHorizontal: 14, paddingVertical: 8 },
  searchBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  filtersToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: spacing(1) },
  filtersToggleText: { fontSize: 12, fontWeight: '700', color: P.muted },

  filterCard: { marginBottom: spacing(2) },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing(1.5) },
  dateFieldWrap: { flex: 1, marginBottom: 0 },
  dateInput: { borderColor: P.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: P.surfaceRaised, minHeight: 0 },
  customTo: { fontSize: 12, color: P.muted },
  filterLabel: { fontSize: 10.5, fontWeight: '800', color: P.muted, letterSpacing: 0.5, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: P.surfaceRaised, borderWidth: 1, borderColor: P.border, maxWidth: 200 },
  chipActive: { backgroundColor: P.primary, borderColor: P.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: P.muted },
  chipTextActive: { color: '#fff' },

  errorCard: { backgroundColor: '#fef2f2', marginBottom: spacing(2) },
  errorText: { color: P.red, fontSize: 13, fontWeight: '600' },

  resultHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  resultCount: { fontSize: 12, fontWeight: '700', color: P.muted },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: P.primary, borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 5 },
  exportBtnText: { fontSize: 11, fontWeight: '800', color: P.primary },

  hintCard: { marginBottom: spacing(2) },
  hintText: { color: P.muted, textAlign: 'center', fontSize: 13 },

  itemCard: { marginBottom: spacing(1.5), padding: 0, overflow: 'hidden' },
  itemHead: { flexDirection: 'row', alignItems: 'center', padding: spacing(2) },
  itemName: { fontSize: 13.5, fontWeight: '800', color: P.ink },
  itemSub: { fontSize: 11, color: P.muted, marginTop: 2 },
  itemDates: { fontSize: 10.5, color: P.muted, marginTop: 2 },
  itemBalWrap: { alignItems: 'flex-end', marginLeft: spacing(1), gap: 2 },
  itemBalValue: { fontSize: 16, fontWeight: '800', color: P.primary },
  itemBalLabel: { fontSize: 9.5, color: P.muted },

  sizeList: { borderTopWidth: 1, borderTopColor: P.border, padding: spacing(1.5), gap: spacing(1.5) },
  sizeRow: { gap: 6 },
  sizeLabel: { fontSize: 11.5, fontWeight: '800', color: P.ink },

  totalsRow: { marginTop: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  totalsLabel: { fontSize: 10.5, fontWeight: '800', color: P.primaryDark, letterSpacing: 0.5 },

  statChip: { backgroundColor: P.surfaceRaised, borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  statChipHighlight: { backgroundColor: '#ccfbf1' },
  statChipValue: { fontSize: 12, fontWeight: '800', color: P.ink },
  statChipValueHighlight: { color: P.primaryDark },
  statChipLabel: { fontSize: 8.5, color: P.muted, marginTop: 1 },
  statChipStrong: { backgroundColor: P.primary },
  statChipValueStrong: { color: '#fff' },
  statChipLabelStrong: { color: 'rgba(255,255,255,0.8)' },
});
