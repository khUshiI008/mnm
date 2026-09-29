import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { colors, radius, shadow, spacing } from '../../theme';
import DateField from '../../components/DateField';
import Icon from '../../components/Icon';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';
import {
  getSaleReport,
  SaleReportFilters,
  SaleReportSummary,
  SaleReportItemRow,
  SaleReportDayRow,
} from '../../api/partySaleReportApi';

const P = colors.party;

const PERIOD_OPTIONS: { key: SaleReportFilters['periodMode']; label: string }[] = [
  { key: 'mtd', label: 'MTD' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

type StringFilterOptions = {
  departments: string[];
  categories: string[];
  colors: string[];
  sizes: string[];
  articles: string[];
  billNos: string[];
};
const EMPTY_FILTER_OPTIONS: StringFilterOptions = { departments: [], categories: [], colors: [], sizes: [], articles: [], billNos: [] };

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function discPct(mrp: number, discount: number) {
  if (mrp > 0 && discount > 0) return `${Math.round((discount / mrp) * 1000) / 10}%`;
  return '';
}
function csvEscape(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function isDayRow(r: SaleReportItemRow | SaleReportDayRow): r is SaleReportDayRow {
  return (r as SaleReportDayRow).lines !== undefined;
}

/** Adapts a plain string[] option list (Department/Category/Color/Size/Article/Bill
 * No — all free-text narrowing filters, unlike the numeric-id Brand checklist) onto
 * MultiSelectPickerModal's Set<number> id contract, using the option's own array
 * index as a throwaway id recomputed fresh every render. Selection itself is
 * tracked by the string VALUE (not the index) so it survives filterOptions being
 * re-fetched with a different order/count on the next load(). */
function useStringMultiSelect(options: string[], selected: Set<string>) {
  const modalOptions = useMemo<MultiSelectOption[]>(() => options.map((label, id) => ({ id, label })), [options]);
  const selectedIds = useMemo(() => {
    const s = new Set<number>();
    options.forEach((label, id) => {
      if (selected.has(label)) s.add(id);
    });
    return s;
  }, [options, selected]);
  const idsToLabels = (ids: Set<number>) => new Set(Array.from(ids).map((id) => options[id]).filter((v): v is string => v !== undefined));
  return { modalOptions, selectedIds, idsToLabels };
}

export default function PartySaleReportScreen() {
  const [periodMode, setPeriodMode] = useState<SaleReportFilters['periodMode']>('mtd');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [viewMode, setViewMode] = useState<'item' | 'day'>('item');
  const [sort, setSort] = useState('bill');
  const [search, setSearch] = useState('');
  const [brandIds, setBrandIds] = useState<Set<number>>(new Set());
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);

  // Department/Category/Color/Size/Article/Bill No — optional narrowing filters
  // (unlike Brand, an EMPTY selection here means "unrestricted", never "match
  // nothing" — see partySaleReportService.js's applyNarrowingFilter), so these
  // default to empty sets and are only sent to the server once non-empty.
  const [departmentNames, setDepartmentNames] = useState<Set<string>>(new Set());
  const [categoryNames, setCategoryNames] = useState<Set<string>>(new Set());
  const [colorNames, setColorNames] = useState<Set<string>>(new Set());
  const [sizeNames, setSizeNames] = useState<Set<string>>(new Set());
  const [articleNos, setArticleNos] = useState<Set<string>>(new Set());
  const [billNos, setBillNos] = useState<Set<string>>(new Set());
  const [filterOptions, setFilterOptions] = useState<StringFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [articlePickerOpen, setArticlePickerOpen] = useState(false);
  const [billNoPickerOpen, setBillNoPickerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SaleReportSummary | null>(null);
  const [rows, setRows] = useState<(SaleReportItemRow | SaleReportDayRow)[]>([]);
  const [brandOptions, setBrandOptions] = useState<{ id: number; name: string }[]>([]);
  const [hideBrandName, setHideBrandName] = useState(false);
  const [extraDescOptions, setExtraDescOptions] = useState<string[]>([]);
  const [scopeName, setScopeName] = useState('');
  // The server-resolved from/to for whichever period is currently on screen —
  // needed (rather than just customFrom/customTo) because a preset like "This
  // Week" never populates those two fields, yet Prev/Next range navigation
  // still needs to know exactly what window is showing in order to shift it.
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: SaleReportFilters = {
        periodMode,
        from: periodMode === 'custom' ? customFrom || undefined : undefined,
        to: periodMode === 'custom' ? customTo || undefined : undefined,
        viewMode,
        sort,
        search: search.trim() || undefined,
        brandIds: brandIds.size ? Array.from(brandIds) : undefined,
        departmentNames: departmentNames.size ? Array.from(departmentNames) : undefined,
        categories: categoryNames.size ? Array.from(categoryNames) : undefined,
        colors: colorNames.size ? Array.from(colorNames) : undefined,
        sizes: sizeNames.size ? Array.from(sizeNames) : undefined,
        articles: articleNos.size ? Array.from(articleNos) : undefined,
        billNos: billNos.size ? Array.from(billNos) : undefined,
      };
      const res = await getSaleReport(filters);
      setSummary(res.data.summary);
      setRows(res.data.rows);
      setBrandOptions(res.data.scope.brandOptions);
      setHideBrandName(res.data.scope.hideBrandName);
      setExtraDescOptions(res.data.scope.extraDescOptions || []);
      setScopeName(res.data.scope.displayName);
      setFilterOptions(res.data.filterOptions || EMPTY_FILTER_OPTIONS);
      setReportFrom(res.data.from);
      setReportTo(res.data.to);
      // Default every brand checked the first time options arrive, matching
      // the .NET checklist's default all-checked state. When hideBrandName
      // is true the server never sends real brand options, so this is a
      // no-op and the picker stays hidden (see render below).
      setBrandIds((prev) => (prev.size ? prev : new Set(res.data.scope.brandOptions.map((b) => b.id))));
    } catch {
      Alert.alert('Could not load Sale Report');
    } finally {
      setLoading(false);
    }
  }, [
    periodMode,
    customFrom,
    customTo,
    viewMode,
    sort,
    search,
    brandIds,
    departmentNames,
    categoryNames,
    colorNames,
    sizeNames,
    articleNos,
    billNos,
  ]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMode, customFrom, customTo, viewMode, sort, departmentNames, categoryNames, colorNames, sizeNames, articleNos, billNos]);

  const onSearchSubmit = () => load();

  // Previous/Next range navigation — shifts the CURRENTLY DISPLAYED from/to
  // window backward or forward by its own span (a week stays a week, a custom
  // 10-day range steps 10 days at a time), same math as SaleReport.aspx.cs's
  // ShiftRangeAndGenerate. Always switches to "custom" since the shifted
  // window generally no longer aligns with a named preset.
  const shiftRange = (direction: number) => {
    if (!reportFrom || !reportTo) return;
    const from = new Date(`${reportFrom}T00:00:00`);
    const to = new Date(`${reportTo}T00:00:00`);
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const shiftMs = direction * spanDays * 86400000;
    setCustomFrom(fmtDateISO(new Date(from.getTime() + shiftMs)));
    setCustomTo(fmtDateISO(new Date(to.getTime() + shiftMs)));
    setPeriodMode('custom');
  };

  const exportCsv = async () => {
    if (!rows.length) return;
    try {
      const lines: string[] = [];
      if (viewMode === 'day') {
        lines.push(['Date', 'Bill No', 'Article No', 'Item Code', 'Category', 'Color', 'Size', 'Brand', 'Qty', 'MRP', 'Discount', 'Amount', 'Return'].join(','));
        (rows as SaleReportDayRow[]).forEach((r) => {
          r.lines.forEach((l) => {
            const isReturn = l.qty < 0 || l.amount < 0;
            lines.push(
              [r.date, r.billNo, l.articleNo, l.itemCode, l.category, l.color, l.size, l.brand, l.qty, l.mrp, l.discount, l.amount, isReturn ? 'Y' : 'N']
                .map(csvEscape)
                .join(',')
            );
          });
        });
      } else {
        lines.push(['Article No', 'Item Code', 'Brand', 'Category', 'Department', 'Color', 'Size', 'Bills', 'Qty', 'MRP Total', 'Disc Total', 'Amt Total'].join(','));
        (rows as SaleReportItemRow[]).forEach((r) => {
          lines.push(
            [r.articleNo, r.itemCode, r.brand, r.category, r.dept, r.color, r.size, r.billCount, r.qty, r.mrpTotal, r.discTotal, r.amtTotal]
              .map(csvEscape)
              .join(',')
          );
        });
      }
      // Leading BOM so Excel opens the file as UTF-8 without a manual import
      // step — same reasoning as SaleReport.aspx.cs's btnExportCsv_Click.
      const csvContent = '﻿' + lines.join('\n');
      const filename = `SaleReport_${reportFrom || 'from'}_${reportTo || 'to'}.csv`;
      const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await ReactNativeBlobUtil.fs.writeFile(path, csvContent, 'utf8');
      await Share.open({ url: `file://${path}`, filename, type: 'text/csv', failOnCancel: false });
    } catch {
      Alert.alert('Could not export report');
    }
  };

  // WhatsApp share — same wa.me deep link (no recipient) used elsewhere in the
  // app (see PartyPanelListScreen.tsx), carrying an equivalent plain-text
  // summary to SaleReport.aspx's srShareWhatsApp() (period / Bills / Net Qty /
  // Net Amt), swapping its page-URL line for the Party's own scope name since
  // there's no public report link on mobile.
  const shareWhatsApp = () => {
    if (!summary) return;
    const periodLbl = PERIOD_OPTIONS.find((p) => p.key === periodMode)?.label || periodMode;
    const rangeText = reportFrom && reportTo ? ` (${reportFrom} to ${reportTo})` : '';
    const msg =
      `Sale Report - ${periodLbl}${rangeText}\n` +
      `Bills: ${summary.billCount}\n` +
      `Net Qty: ${summary.totQty}\n` +
      `Net Amt: Rs.${Math.round(summary.totAmt).toLocaleString('en-IN')}\n` +
      (scopeName || '');
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('Could not open WhatsApp', 'Please make sure WhatsApp is installed.')
    );
  };

  const sortOptions = useMemo(
    () =>
      viewMode === 'day'
        ? [
            { key: 'bill', label: 'Newest First' },
            { key: 'date_asc', label: 'Oldest First' },
            { key: 'amt_desc', label: 'Amount ↓' },
            { key: 'amt_asc', label: 'Amount ↑' },
            { key: 'qty_desc', label: 'Qty ↓' },
            { key: 'qty_asc', label: 'Qty ↑' },
          ]
        : [
            { key: 'bill', label: 'Article No' },
            { key: 'amt_desc', label: 'Amount ↓' },
            { key: 'amt_asc', label: 'Amount ↑' },
            { key: 'qty_desc', label: 'Qty ↓' },
            { key: 'qty_asc', label: 'Qty ↑' },
          ],
    [viewMode]
  );

  const deptMs = useStringMultiSelect(filterOptions.departments, departmentNames);
  const categoryMs = useStringMultiSelect(filterOptions.categories, categoryNames);
  const colorMs = useStringMultiSelect(filterOptions.colors, colorNames);
  const sizeMs = useStringMultiSelect(filterOptions.sizes, sizeNames);
  const articleMs = useStringMultiSelect(filterOptions.articles, articleNos);
  const billNoMs = useStringMultiSelect(filterOptions.billNos, billNos);

  const hasAnyFilterOptions =
    filterOptions.departments.length > 0 ||
    filterOptions.categories.length > 0 ||
    filterOptions.colors.length > 0 ||
    filterOptions.sizes.length > 0 ||
    filterOptions.articles.length > 0 ||
    filterOptions.billNos.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.periodNavRow}>
        <Pressable style={styles.periodArrow} onPress={() => shiftRange(-1)} hitSlop={8}>
          <Icon name="chevronLeft" size={18} color={P.ink} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing(1) }}>
          {PERIOD_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={[styles.periodChip, periodMode === opt.key && styles.periodChipActive]} onPress={() => setPeriodMode(opt.key)}>
              <Text style={[styles.periodChipText, periodMode === opt.key && styles.periodChipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.periodArrow} onPress={() => shiftRange(1)} hitSlop={8}>
          <Icon name="chevronRight" size={18} color={P.ink} />
        </Pressable>
      </View>

      {!!reportFrom && !!reportTo && (
        <Text style={styles.rangeLabel}>
          {reportFrom} to {reportTo}
        </Text>
      )}

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

      <View style={styles.controlsRow}>
        <View style={styles.viewToggle}>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'item' && styles.viewToggleBtnActive]} onPress={() => setViewMode('item')}>
            <Text style={[styles.viewToggleText, viewMode === 'item' && styles.viewToggleTextActive]}>Item-wise</Text>
          </Pressable>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'day' && styles.viewToggleBtnActive]} onPress={() => setViewMode('day')}>
            <Text style={[styles.viewToggleText, viewMode === 'day' && styles.viewToggleTextActive]}>Day-wise</Text>
          </Pressable>
        </View>
        <View style={styles.sortWrap}>
          <Picker selectedValue={sort} onValueChange={(v) => setSort(String(v))} style={styles.sortPicker}>
            {sortOptions.map((o) => (
              <Picker.Item key={o.key} label={o.label} value={o.key} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search bill / article / category..."
          placeholderTextColor={P.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
        />
        {!hideBrandName && brandOptions.length > 1 && (
          <Pressable style={styles.brandBtn} onPress={() => setBrandPickerOpen(true)}>
            <Text style={styles.brandBtnText}>Brands ({brandIds.size})</Text>
          </Pressable>
        )}
      </View>

      {hideBrandName && extraDescOptions.length > 0 && (
        <View style={styles.extraDescRow}>
          {extraDescOptions.map((d) => (
            <View key={d} style={styles.extraDescChip}>
              <Text style={styles.extraDescChipText}>{d}</Text>
            </View>
          ))}
        </View>
      )}

      {hasAnyFilterOptions && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBtnRow} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing(2) }}>
          {filterOptions.departments.length > 0 && <FilterButton label="Departments" count={departmentNames.size} onPress={() => setDeptPickerOpen(true)} />}
          {filterOptions.categories.length > 0 && <FilterButton label="Categories" count={categoryNames.size} onPress={() => setCategoryPickerOpen(true)} />}
          {filterOptions.colors.length > 0 && <FilterButton label="Colors" count={colorNames.size} onPress={() => setColorPickerOpen(true)} />}
          {filterOptions.sizes.length > 0 && <FilterButton label="Sizes" count={sizeNames.size} onPress={() => setSizePickerOpen(true)} />}
          {filterOptions.articles.length > 0 && <FilterButton label="Articles" count={articleNos.size} onPress={() => setArticlePickerOpen(true)} />}
          {filterOptions.billNos.length > 0 && <FilterButton label="Bill No" count={billNos.size} onPress={() => setBillNoPickerOpen(true)} />}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={P.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {summary && (
            <View style={styles.summaryGrid}>
              <SummaryCard label="Bills" value={String(summary.billCount)} />
              <SummaryCard label="Net Qty" value={String(summary.totQty)} />
              <SummaryCard label="Net Amt" value={money(summary.totAmt)} sub={summary.calcCheck ? '✓' : '△'} />
              <SummaryCard label="MRP" value={money(summary.totMrp)} />
              <SummaryCard label="Disc Total" value={money(summary.totDisc)} />
              <SummaryCard label="Avg Bill Amt" value={money(summary.avgBillAmt)} />
              <SummaryCard label="Avg Qty/Bill" value={String(summary.avgQtyPerBill)} />
              <SummaryCard label="Avg Disc/Bill" value={money(summary.avgDiscPerBill)} />
              {summary.hasReturns ? (
                <>
                  <SummaryCard label="Return Qty" value={String(summary.totReturnQty)} />
                  <SummaryCard label="Returns" value={money(summary.totReturnAmt)} />
                </>
              ) : (
                <SummaryCard label="Avg Disc" value={money(summary.avgDiscAmt)} />
              )}
              <SummaryCard label="Avg Disc %" value={`${summary.avgDiscPct}%`} />
            </View>
          )}

          <View style={styles.exportRow}>
            <Pressable style={[styles.exportBtn, !rows.length && styles.exportBtnDisabled]} onPress={exportCsv} disabled={!rows.length}>
              <Icon name="document" size={14} color={P.primary} />
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </Pressable>
            <Pressable style={[styles.exportBtn, !summary && styles.exportBtnDisabled]} onPress={shareWhatsApp} disabled={!summary}>
              <Icon name="share" size={14} color={P.primary} />
              <Text style={styles.exportBtnText}>Share</Text>
            </Pressable>
          </View>

          <Text style={styles.countText}>
            {rows.length} row(s) {scopeName ? `· ${scopeName}` : ''}
          </Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No sales found for this period.</Text>
          ) : viewMode === 'item' ? (
            (rows as SaleReportItemRow[]).map((r, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {r.articleNo} {r.color ? `· ${r.color}` : ''} {r.size ? `· ${r.size}` : ''}
                  </Text>
                  {r.qty < 0 && <ReturnBadge />}
                </View>
                <Text style={styles.sub} numberOfLines={1}>
                  {[r.brand, r.itemCode, r.category, r.dept].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statChip}>{r.billCount} bill(s)</Text>
                  <Text style={styles.statChip}>Qty {r.qty}</Text>
                  <Text style={styles.statChip}>MRP {money(r.mrpTotal)}</Text>
                  <Text style={styles.statChip}>Disc {money(r.discTotal)}</Text>
                  <Text style={styles.statChipStrong}>Amt {money(r.amtTotal)}</Text>
                </View>
              </View>
            ))
          ) : (
            (rows as SaleReportDayRow[]).map((r) => {
              const key = `${r.billNo}|${r.date}`;
              const expanded = expandedBill === key;
              return (
                <Pressable key={key} style={styles.card} onPress={() => setExpandedBill(expanded ? null : key)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.itemTitle}>{r.billNo}</Text>
                    <Text style={styles.dateText}>{formatDate(r.date)}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <Text style={styles.statChip}>Qty {r.qty}</Text>
                    <Text style={styles.statChipStrong}>Amt {money(r.amount)}</Text>
                    <Text style={styles.expandHint}>{expanded ? 'Hide items ▲' : `${r.lines.length} item(s) ▼`}</Text>
                  </View>
                  {expanded &&
                    r.lines.map((l, i) => {
                      const isReturn = l.qty < 0 || l.amount < 0;
                      const dPct = discPct(l.mrp, l.discount);
                      return (
                        <View key={i} style={styles.lineRow}>
                          <View style={styles.lineHeaderRow}>
                            <Text style={styles.lineText} numberOfLines={1}>
                              {l.articleNo} {l.color ? `· ${l.color}` : ''} {l.size ? `· ${l.size}` : ''}
                            </Text>
                            {isReturn && <ReturnBadge />}
                          </View>
                          <Text style={styles.lineSub} numberOfLines={1}>
                            {[l.brand, l.itemCode, l.category].filter(Boolean).join(' · ')}
                          </Text>
                          <View style={styles.statsRow}>
                            <Text style={styles.statChip}>Qty {l.qty}</Text>
                            <Text style={styles.statChip}>MRP {money(l.mrp)}</Text>
                            {l.discount > 0 && (
                              <Text style={styles.statChip}>
                                Disc {money(l.discount)}
                                {dPct ? ` (${dPct})` : ''}
                              </Text>
                            )}
                            <Text style={styles.statChipStrong}>Amt {money(l.amount)}</Text>
                          </View>
                        </View>
                      );
                    })}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      <MultiSelectPickerModal
        visible={!hideBrandName && brandPickerOpen}
        title="Select Brands"
        options={brandOptions.map((b) => ({ id: b.id, label: b.name } as MultiSelectOption))}
        selectedIds={brandIds}
        onChange={(next) => {
          setBrandIds(next);
          setBrandPickerOpen(false);
        }}
        onClose={() => setBrandPickerOpen(false)}
      />

      <MultiSelectPickerModal
        visible={deptPickerOpen}
        title="Select Departments"
        emptyMeansAllHint="Empty = all departments"
        options={deptMs.modalOptions}
        selectedIds={deptMs.selectedIds}
        onChange={(ids) => {
          setDepartmentNames(deptMs.idsToLabels(ids));
          setDeptPickerOpen(false);
        }}
        onClose={() => setDeptPickerOpen(false)}
      />

      <MultiSelectPickerModal
        visible={categoryPickerOpen}
        title="Select Categories"
        emptyMeansAllHint="Empty = all categories"
        options={categoryMs.modalOptions}
        selectedIds={categoryMs.selectedIds}
        onChange={(ids) => {
          setCategoryNames(categoryMs.idsToLabels(ids));
          setCategoryPickerOpen(false);
        }}
        onClose={() => setCategoryPickerOpen(false)}
      />

      <MultiSelectPickerModal
        visible={colorPickerOpen}
        title="Select Colors"
        emptyMeansAllHint="Empty = all colors"
        options={colorMs.modalOptions}
        selectedIds={colorMs.selectedIds}
        onChange={(ids) => {
          setColorNames(colorMs.idsToLabels(ids));
          setColorPickerOpen(false);
        }}
        onClose={() => setColorPickerOpen(false)}
      />

      <MultiSelectPickerModal
        visible={sizePickerOpen}
        title="Select Sizes"
        emptyMeansAllHint="Empty = all sizes"
        options={sizeMs.modalOptions}
        selectedIds={sizeMs.selectedIds}
        onChange={(ids) => {
          setSizeNames(sizeMs.idsToLabels(ids));
          setSizePickerOpen(false);
        }}
        onClose={() => setSizePickerOpen(false)}
      />

      <MultiSelectPickerModal
        visible={articlePickerOpen}
        title="Select Articles"
        emptyMeansAllHint="Empty = all articles"
        options={articleMs.modalOptions}
        selectedIds={articleMs.selectedIds}
        onChange={(ids) => {
          setArticleNos(articleMs.idsToLabels(ids));
          setArticlePickerOpen(false);
        }}
        onClose={() => setArticlePickerOpen(false)}
      />

      <MultiSelectPickerModal
        visible={billNoPickerOpen}
        title="Select Bill No"
        emptyMeansAllHint="Empty = all bill numbers"
        options={billNoMs.modalOptions}
        selectedIds={billNoMs.selectedIds}
        onChange={(ids) => {
          setBillNos(billNoMs.idsToLabels(ids));
          setBillNoPickerOpen(false);
        }}
        onClose={() => setBillNoPickerOpen(false)}
      />
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

function FilterButton({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
  return (
    <Pressable style={styles.filterBtn} onPress={onPress}>
      <Text style={styles.filterBtnText}>
        {label}
        {count ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

/** Small status-badge look, same convention as components/StatusBadge.tsx
 * (tinted background = color + '22', bold tinted label text). */
function ReturnBadge() {
  return (
    <View style={styles.returnBadge}>
      <Text style={styles.returnBadgeText}>RETURN</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },

  periodNavRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing(1.5), paddingHorizontal: spacing(1) },
  periodArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.border },
  periodRow: { flexGrow: 0, flex: 1 },
  periodChip: { height: 32, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface, alignItems: 'center', justifyContent: 'center' },
  periodChipActive: { backgroundColor: P.primary, borderColor: P.primary },
  periodChipText: { fontSize: 11.5, fontWeight: '700', color: P.muted },
  periodChipTextActive: { color: '#fff' },
  rangeLabel: { fontSize: 11, color: P.muted, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  customRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), marginTop: 8 },

  controlsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), marginTop: 10, alignItems: 'center' },
  viewToggle: { flexDirection: 'row', backgroundColor: P.surfaceRaised, borderRadius: radius.sm, padding: 3, flex: 1 },
  viewToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm - 2, alignItems: 'center' },
  viewToggleBtnActive: { backgroundColor: P.primary },
  viewToggleText: { fontSize: 12, fontWeight: '700', color: P.muted },
  viewToggleTextActive: { color: '#fff' },
  sortWrap: { flex: 1, borderWidth: 1, borderColor: P.border, borderRadius: radius.sm, backgroundColor: P.surface, justifyContent: 'center' },
  sortPicker: { color: P.ink },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing(2), marginTop: 10 },
  searchInput: { flex: 1, height: 40, borderWidth: 1, borderColor: P.border, borderRadius: radius.sm, backgroundColor: P.surface, paddingHorizontal: 12, color: P.ink, fontSize: 13 },
  brandBtn: { height: 40, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: P.primary, alignItems: 'center', justifyContent: 'center' },
  brandBtnText: { color: P.primary, fontWeight: '700', fontSize: 11.5 },

  extraDescRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing(2), marginTop: 10 },
  extraDescChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: P.surfaceRaised, borderWidth: 1, borderColor: P.border },
  extraDescChipText: { fontSize: 11, fontWeight: '700', color: P.ink },

  filterBtnRow: { flexGrow: 0, marginTop: 10 },
  filterBtn: { height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  filterBtnText: { fontSize: 11, fontWeight: '700', color: P.ink },

  exportRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(1.5) },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.sm, borderWidth: 1.5, borderColor: P.primary },
  exportBtnDisabled: { opacity: 0.4 },
  exportBtnText: { color: P.primary, fontWeight: '700', fontSize: 11.5 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  summaryCard: { width: '31%', backgroundColor: P.surface, borderRadius: radius.sm, padding: 10, ...shadow.card },
  summaryLabel: { fontSize: 10, color: P.muted, fontWeight: '600', marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: '800', color: P.ink },
  summarySub: { fontSize: 11, color: P.green },

  countText: { color: P.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: P.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: P.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  itemTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: P.ink },
  dateText: { fontSize: 11, color: P.muted },
  sub: { fontSize: 11.5, color: P.muted, marginBottom: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  statChip: { fontSize: 10.5, fontWeight: '700', color: P.ink, backgroundColor: P.surfaceRaised, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statChipStrong: { fontSize: 10.5, fontWeight: '800', color: P.primary, backgroundColor: P.surfaceRaised, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  expandHint: { fontSize: 10.5, color: P.muted, marginLeft: 'auto' },

  returnBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: P.red + '22' },
  returnBadgeText: { fontSize: 9.5, fontWeight: '800', color: P.red },

  lineRow: { paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: P.border },
  lineHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lineText: { flex: 1, fontSize: 11.5, color: P.ink, fontWeight: '700' },
  lineSub: { fontSize: 10, color: P.muted, marginTop: 2, marginBottom: 6 },
});
