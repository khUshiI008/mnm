import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import Card from '../../components/Card';
import Button from '../../components/Button';
import DateField from '../../components/DateField';
import Icon from '../../components/Icon';
import { Picker } from '../../components/AppPicker';
import { colors, radius, shadow, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';
import { MAX_IMAGE_ROWS, offscreenCaptureStyle, safeFilePart, shareRowsAsCsv, shareViewAsImage, useCaptureShare } from '../../utils/reportShare';
import {
  DayBillItem,
  DayBillSequenceData,
  getSalesReport,
  getSalesReportDepartments,
  getSalesReportRowDetail,
  getTrendDayBills,
  requestArticlePicture,
  RowDetailData,
  SalesComparisonPeriod,
  SalesReportData,
  SalesReportSegment,
  SalesReportType,
  SalesReportValueType,
  WeeklyComparisonRow,
} from '../../api/adminSalesReportsHubApi';
import MiniChart, { ChartType, LegendRow } from '../../components/admin/MiniChart';

const A = colors.admin;

// Bottom-sheet drill-down modals (RowDetailModal, DayBillsModal) size their
// FlatList off actual screen height rather than a fixed px value — on a
// short device a fixed 420 could exceed the space modalBox (maxHeight '80%')
// actually has left after the title/subtitle/export row, which on Android
// left the FlatList without a properly bounded viewport to scroll within.
const MODAL_LIST_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.5);

type Params = { reportKey: string; title: string; valueType: SalesReportValueType; reportType: SalesReportType };

const PERIOD_OPTIONS: { key: SalesComparisonPeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

function toDateKey(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function moneyFormatter(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function countFormatter(n: number) {
  return Math.round(n).toLocaleString('en-IN');
}

/**
 * Generic pie/line/bar report detail screen — one component handles every
 * report in the Sales Dashboard catalog (SalesReportsHubScreen), driven by
 * the `reportType`/`valueType` the hub passed through from the backend
 * catalog rather than per-report hardcoded screens.
 */
export default function SalesReportDetailScreen({ params }: { params?: Params }) {
  const reportKey = params?.reportKey || '';
  const title = params?.title || 'Report';
  const valueType = params?.valueType || 'currency';
  const reportType = params?.reportType || 'dimension';

  const showDateFilter = reportType === 'dimension' || reportType === 'trend';
  const showPeriodFilter = reportType === 'comparison';
  const chartType: ChartType = reportType === 'dimension' ? 'pie' : reportType === 'comparison' ? 'bar' : 'line';
  const formatValue = valueType === 'count' ? countFormatter : moneyFormatter;

  const [fromDt, setFromDt] = useState('');
  const [toDt, setToDt] = useState('');
  const [periodType, setPeriodType] = useState<SalesComparisonPeriod>('month');
  const [departments, setDepartments] = useState<string[]>([]);
  const [dept, setDept] = useState<string | null>(null);
  const deptLabel = dept || 'All Departments';
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowDetailVisible, setRowDetailVisible] = useState(false);
  const [rowDetailLoading, setRowDetailLoading] = useState(false);
  const [rowDetailData, setRowDetailData] = useState<RowDetailData | null>(null);
  const [dayBillsVisible, setDayBillsVisible] = useState(false);
  const [dayBillsLoading, setDayBillsLoading] = useState(false);
  const [dayBillsData, setDayBillsData] = useState<DayBillSequenceData | null>(null);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<View>(null);
  // Dimension-type reports render their list via a virtualized FlatList (see
  // below), so a plain captureRef on the on-screen view would only ever grab
  // the currently-visible rows — this hook instead renders every row
  // off-screen just for the capture, see reportShare.ts's doc comment.
  const dimCapture = useCaptureShare(`${safeFilePart(title)}.png`);

  const load = useCallback(
    async (f?: string, t?: string, period?: SalesComparisonPeriod, deptOverride?: string | null) => {
      setLoading(true);
      try {
        const activeDept = deptOverride !== undefined ? deptOverride : dept;
        const queryParams = {
          ...(showPeriodFilter ? { periodType: period || periodType } : showDateFilter ? { fromDt: f || undefined, toDt: t || undefined } : {}),
          dept: activeDept || undefined,
        };
        const res = await getSalesReport(reportKey, queryParams);
        setData(res.data);
        // First load has no explicit range — backfill the pickers from whatever
        // default range the backend actually used, so "Apply Filter" edits from there.
        if (showDateFilter) {
          if (!f) setFromDt(toDateKey(res.data.fromDt));
          if (!t) setToDt(toDateKey(res.data.toDt));
        }
      } catch (err: any) {
        Alert.alert('Could not load report', err?.response?.data?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [reportKey, showDateFilter, showPeriodFilter, periodType, dept]
  );

  useEffect(() => {
    load();
    getSalesReportDepartments()
      .then((res) => setDepartments(res.data.departments))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey]);

  const changePeriod = (p: SalesComparisonPeriod) => {
    setPeriodType(p);
    load(undefined, undefined, p);
  };

  const changeDept = (d: string | null) => {
    setDept(d);
    load(fromDt || undefined, toDt || undefined, periodType, d);
  };

  const openRowDetail = async (label: string) => {
    setRowDetailVisible(true);
    setRowDetailLoading(true);
    setRowDetailData(null);
    try {
      const res = await getSalesReportRowDetail(reportKey, label, { fromDt: fromDt || undefined, toDt: toDt || undefined, dept: dept || undefined });
      setRowDetailData(res.data);
    } catch (err: any) {
      setRowDetailVisible(false);
      Alert.alert('Could not load detail', err?.response?.data?.message || 'Please try again.');
    } finally {
      setRowDetailLoading(false);
    }
  };

  const openDayBills = async (dateKey?: string) => {
    if (!dateKey) return;
    setDayBillsVisible(true);
    setDayBillsLoading(true);
    setDayBillsData(null);
    try {
      const res = await getTrendDayBills(dateKey, { dept: dept || undefined });
      setDayBillsData(res.data);
    } catch (err: any) {
      setDayBillsVisible(false);
      Alert.alert('Could not load bills', err?.response?.data?.message || 'Please try again.');
    } finally {
      setDayBillsLoading(false);
    }
  };

  // Used by the week/trend/progress/comparison branches below, whose full
  // content (summary + chart + list) is already rendered on-screen (small,
  // date-bounded lists, never virtualized) — capturing shotRef directly
  // already gets everything. Dimension-type reports use dimCapture instead
  // (see above): their list is a virtualized FlatList, so a plain captureRef
  // on the on-screen view would only ever grab the visible rows.
  const shareImage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareViewAsImage(shotRef, `${safeFilePart(title)}.png`);
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) Alert.alert('Could not share', 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const shareCsv = async () => {
    if (sharing || !data) return;
    setSharing(true);
    try {
      if (data.periodType === 'week' && data.weeklyRows) {
        const rows = data.weeklyRows.map((r) => [`Week ${r.weekNum}`, r.rangeLabel, r.value, r.qty, r.pctChange ?? '']);
        await shareRowsAsCsv(['Week', 'Range', 'Value', 'Qty', '% Change'], rows, `${safeFilePart(title)}.csv`);
      } else {
        const rows = data.segments.map((s) => [s.label, (s.departments || []).join(', ') || (reportKey === 'department' ? s.label : deptLabel), s.value, s.qty ?? '']);
        await shareRowsAsCsv(['Label', 'Department', valueType === 'count' ? 'Count' : 'Value', 'Qty'], rows, `${safeFilePart(title)}.csv`);
      }
    } catch {
      Alert.alert('Could not export', 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const filterHeader = (
    <>
      <Card style={styles.filterCard}>
        <Text style={styles.deptLabel}>Department</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={dept} onValueChange={(v) => changeDept(v || null)} enabled={!loading}>
            <Picker.Item label="All Departments" value="" />
            {departments.map((d) => (
              <Picker.Item key={d} label={d} value={d} />
            ))}
          </Picker>
        </View>
      </Card>

      {showDateFilter && (
        <Card style={styles.filterCard}>
          <View style={styles.filterRow}>
            <DateField label="From" granularity="day" value={fromDt} onChange={setFromDt} placeholder="Select date" style={styles.dateInput} />
            <DateField label="To" granularity="day" value={toDt} onChange={setToDt} placeholder="Select date" style={styles.dateInput} />
          </View>
          <Button title="Apply Filter" onPress={() => load(fromDt, toDt)} loading={loading} />
        </Card>
      )}

      {showPeriodFilter && (
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((p) => (
            <Pressable
              key={p.key}
              style={[styles.periodBtn, periodType === p.key && styles.periodBtnActive]}
              onPress={() => changePeriod(p.key)}
              disabled={loading}
            >
              <Text style={[styles.periodBtnText, periodType === p.key && styles.periodBtnTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  // Dimension-type reports (SalesPerson/Category/Color/... wise Sale) can
  // have thousands of rows (Category: 2,241, Color: 3,648) — rendering that
  // as a plain `.map()` inside a ScrollView built thousands of un-virtualized
  // native views up front, which is what was freezing the JS thread for
  // ~30s on the first scroll. A FlatList as the screen's own root virtualizes
  // it (only renders what's actually on screen), same principle as the
  // RowDetailModal's list below. Every other report type has an inherently
  // small, date-bounded list, so it keeps the plain ScrollView further down.
  if (reportType === 'dimension') {
    return (
      <>
        <FlatList
          style={styles.screen}
          contentContainerStyle={styles.content}
          data={!loading && data ? data.segments : []}
          keyExtractor={(item, i) => item.label + i}
          ListHeaderComponent={
            <>
              {filterHeader}
              {loading ? (
                <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(4) }} />
              ) : !data || data.segments.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No data found for the selected period.</Text>
                </Card>
              ) : (
                <>
                  <Card style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>{title}</Text>
                    <Text style={styles.summaryValue}>{formatValue(data.total)}</Text>
                    {data.totalQty != null && <Text style={styles.summaryQty}>{data.totalQty.toLocaleString('en-IN')} pcs</Text>}
                    <Text style={styles.summaryDept}>Department: {deptLabel}</Text>
                  </Card>
                  <Card style={styles.chartCard}>
                    <MiniChart data={data.segments} type="pie" formatValue={formatValue} hideLegend />
                  </Card>
                  <ExportRow sharing={dimCapture.sharing} onImage={dimCapture.startCapture} onCsv={shareCsv} />
                </>
              )}
            </>
          }
          renderItem={({ item, index }) =>
            data ? <LegendRow item={item} index={index} total={data.total} showPct formatValue={formatValue} onPress={openRowDetail} /> : null
          }
        />

        {/* Off-screen full-list render, only mounted while capturing — see reportShare.ts. */}
        {dimCapture.capturing && data && (
          <View ref={dimCapture.ref} collapsable={false} style={offscreenCaptureStyle}>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{title}</Text>
              <Text style={styles.summaryValue}>{formatValue(data.total)}</Text>
              {data.totalQty != null && <Text style={styles.summaryQty}>{data.totalQty.toLocaleString('en-IN')} pcs</Text>}
              <Text style={styles.summaryDept}>Department: {deptLabel}</Text>
            </Card>
            <Card style={styles.chartCard}>
              <MiniChart data={data.segments} type="pie" formatValue={formatValue} hideLegend />
            </Card>
            <Card style={styles.chartCard}>
              {data.segments.slice(0, MAX_IMAGE_ROWS).map((item, index) => (
                <LegendRow key={item.label + index} item={item} index={index} total={data.total} showPct formatValue={formatValue} />
              ))}
              {data.segments.length > MAX_IMAGE_ROWS && (
                <Text style={styles.captureTruncatedNote}>
                  +{data.segments.length - MAX_IMAGE_ROWS} more rows — use Export Excel for the full list
                </Text>
              )}
            </Card>
          </View>
        )}

        <RowDetailModal
          visible={rowDetailVisible}
          data={rowDetailData}
          loading={rowDetailLoading}
          formatValue={formatValue}
          onClose={() => setRowDetailVisible(false)}
        />
      </>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {filterHeader}

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={{ marginTop: spacing(4) }} />
      ) : !data || data.segments.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No data found for the selected period.</Text>
        </Card>
      ) : data.periodType === 'week' && data.weeklyRows ? (
        <>
          <View ref={shotRef} collapsable={false}>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Combined ({data.weeklyRows.length} weeks)</Text>
              <Text style={styles.summaryValue}>{formatValue(data.total)}</Text>
              {data.totalQty != null && <Text style={styles.summaryQty}>{data.totalQty.toLocaleString('en-IN')} pcs</Text>}
              <Text style={styles.summaryDept}>Department: {deptLabel}</Text>
            </Card>
            {data.weeklyRows.map((r) => (
              <WeekComparisonCard key={r.weekNum} row={r} formatValue={formatValue} />
            ))}
          </View>
          <ExportRow sharing={sharing} onImage={shareImage} onCsv={shareCsv} />
        </>
      ) : (
        <>
          <View ref={shotRef} collapsable={false}>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{title}</Text>
              <Text style={styles.summaryValue}>{formatValue(data.total)}</Text>
              {data.totalQty != null && <Text style={styles.summaryQty}>{data.totalQty.toLocaleString('en-IN')} pcs</Text>}
              <Text style={styles.summaryDept}>Department: {deptLabel}</Text>
              {data.pctChange != null && (
                <Text style={[styles.pctChange, { color: data.pctChange >= 0 ? '#15803d' : '#b91c1c' }]}>
                  {data.pctChange >= 0 ? '▲' : '▼'} {Math.abs(data.pctChange)}% vs previous
                </Text>
              )}
            </Card>

            {reportKey === 'trendDay' ? (
              <TrendBarChart data={data.segments} formatValue={formatValue} onSelectDay={openDayBills} />
            ) : (
              <Card style={styles.chartCard}>
                <MiniChart data={data.segments} type={chartType} formatValue={formatValue} />
              </Card>
            )}
          </View>
          <ExportRow sharing={sharing} onImage={shareImage} onCsv={shareCsv} />
        </>
      )}

      <DayBillsModal
        visible={dayBillsVisible}
        data={dayBillsData}
        loading={dayBillsLoading}
        formatValue={formatValue}
        onClose={() => setDayBillsVisible(false)}
      />
    </ScrollView>
  );
}

/** Share-as-image / export-as-Excel(CSV) row — appears under every report's summary+chart, and under both drill-down modals (RowDetailModal, DayBillsModal). */
function ExportRow({ sharing, onImage, onCsv }: { sharing: boolean; onImage: () => void; onCsv: () => void }) {
  return (
    <View style={styles.exportRow}>
      <Pressable style={styles.exportBtn} onPress={onImage} disabled={sharing}>
        {sharing ? <ActivityIndicator size="small" color={A.primary} /> : <Icon name="image" size={14} color={A.primary} />}
        <Text style={styles.exportBtnText}>Share Image</Text>
      </Pressable>
      <Pressable style={styles.exportBtn} onPress={onCsv} disabled={sharing}>
        {sharing ? <ActivityIndicator size="small" color={A.primary} /> : <Icon name="document" size={14} color={A.primary} />}
        <Text style={styles.exportBtnText}>Export Excel</Text>
      </Pressable>
    </View>
  );
}

/** Rounds a max axis value up to a clean 1/2/5×10^n step, same convention any chart library's auto-axis uses, so gridlines land on round numbers (30,000 / 60,000 / ... not 27,432 / 54,864 / ...). */
function niceAxisMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const frac = v / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

/**
 * Real horizontal bar chart for Sale Trend Time Wise — axis + gridlines
 * across the top, one bar per day from a shared baseline, the value printed
 * right at the bar's end, day label on the left — matching the .NET web
 * panel's own horizontal-bar report for this data, not a card-per-row
 * approximation of it. The best-selling day in the range is a solid fill,
 * every other day a lighter tint of the same color. Tapping a row (bar or
 * label) opens that day's bill sequence — see onSelectDay/DayBillsModal.
 */
function TrendBarChart({
  data,
  formatValue,
  onSelectDay,
}: {
  data: SalesReportSegment[];
  formatValue: (n: number) => string;
  onSelectDay: (dateKey?: string) => void;
}) {
  if (!data.length) return null;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.value, 0)));
  const axisMax = niceAxisMax(maxVal);
  const peakIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  const leftW = 60; // day-label column
  const chartW = 190; // bar drawing area
  const valueColW = 96; // space for the printed value past the bar end
  const axisH = 22;
  const rowH = 34;
  const barH = 20;
  const svgW = leftW + chartW + valueColW;
  const svgH = axisH + data.length * rowH + 6;

  const TICKS = 6;
  const tickVals = Array.from({ length: TICKS + 1 }, (_, i) => Math.round((axisMax * i) / TICKS));

  return (
    <Card style={styles.trendCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={svgW} height={svgH}>
          {tickVals.map((v, i) => {
            const x = leftW + (v / axisMax) * chartW;
            return (
              <G key={i}>
                <Line x1={x} y1={axisH} x2={x} y2={svgH} stroke={A.border} strokeWidth={1} />
                <SvgText x={x} y={13} fontSize={9} fill={A.muted} textAnchor="middle">
                  {v.toLocaleString('en-IN')}
                </SvgText>
              </G>
            );
          })}

          {data.map((d, i) => {
            const y = axisH + i * rowH + (rowH - barH) / 2;
            const w = Math.max(2, (Math.max(d.value, 0) / axisMax) * chartW);
            const isPeak = i === peakIndex;
            return (
              <G key={d.label + i} onPress={() => onSelectDay(d.dateKey)}>
                <Rect x={leftW} y={y - 2} width={chartW + valueColW} height={barH + 4} fill="transparent" />
                <SvgText x={leftW - 6} y={y + barH / 2 + 4} fontSize={11} fontWeight="700" fill={A.ink} textAnchor="end">
                  {d.label}
                </SvgText>
                <Rect x={leftW} y={y} width={w} height={barH} rx={3} fill={isPeak ? A.primary : A.primary + '80'} />
                <SvgText x={leftW + w + 6} y={y + barH / 2 + 4} fontSize={10.5} fontWeight="700" fill={A.ink}>
                  {formatValue(d.value)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </Card>
  );
}

/**
 * That day's bills, in bill-sequence order — CashmemoDt has no real
 * time-of-day component anywhere in this data (every transaction's
 * timestamp is midnight), so this is the closest available proxy for "how
 * the day's sales flowed": each bill in the order it was actually rung up,
 * not by clock time (which doesn't exist).
 */
function DayBillsModal({
  visible,
  data,
  loading,
  formatValue,
  onClose,
}: {
  visible: boolean;
  data: DayBillSequenceData | null;
  loading: boolean;
  formatValue: (n: number) => string;
  onClose: () => void;
}) {
  const capture = useCaptureShare(`${safeFilePart(data?.title || 'bills')}.png`);
  const [csvSharing, setCsvSharing] = useState(false);

  const shareCsv = async () => {
    if (csvSharing || !data) return;
    setCsvSharing(true);
    try {
      const rows = data.items.map((it: DayBillItem) => [it.cashmemoNo, it.branchName, (it.departments || []).join(', '), it.salesPerson, it.value, it.qty]);
      await shareRowsAsCsv(['Bill No', 'Branch', 'Department', 'Salesperson', 'Value', 'Qty'], rows, `${safeFilePart(data.title)}.csv`);
    } catch {
      Alert.alert('Could not export', 'Please try again.');
    } finally {
      setCsvSharing(false);
    }
  };

  const renderBillRow = (item: DayBillItem, i: number) => (
    <View key={item.cashmemoNo + i} style={styles.modalRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.modalRowLabel} numberOfLines={1}>
          {item.cashmemoNo} · {item.salesPerson}
        </Text>
        <Text style={styles.dayBillBranch} numberOfLines={1}>
          {item.branchName}
          {item.departments && item.departments.length > 0 ? ` · ${item.departments.join(', ')}` : ''}
        </Text>
      </View>
      <Text style={styles.modalRowQty}>{item.qty.toLocaleString('en-IN')} pcs</Text>
      <Text style={styles.modalRowValue}>{formatValue(item.value)}</Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Absolutely-positioned dim layer BEHIND modalBox, not an ancestor of
            it — modalBox used to be a Pressable-inside-Pressable purely to
            stopPropagation() so a tap on it wouldn't also close the modal via
            this backdrop's onPress. That nested-Pressable shape made the
            FlatList below intermittently lose touch-move events to the
            ancestor Pressable's own responder negotiation (worked most taps,
            randomly ate others) — a known RN gesture-conflict class of bug.
            With the backdrop as a plain sibling instead of an ancestor,
            nothing above the FlatList ever competes for the responder, and a
            tap that lands on modalBox's own (non-Pressable) surface simply
            doesn't reach the backdrop underneath, so tap-outside-to-close
            still works exactly as before. */}
        <Pressable style={[StyleSheet.absoluteFill, styles.modalBackdropFill]} onPress={onClose} />
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{data?.title || 'Bills'}</Text>
          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={{ marginVertical: spacing(4) }} />
          ) : (
            <>
              <Text style={styles.modalSub}>
                {data?.count} bill{data?.count === 1 ? '' : 's'} · {formatValue(data?.totalValue || 0)}
                {data?.totalQty != null ? ` · ${data.totalQty.toLocaleString('en-IN')} pcs` : ''}
              </Text>
              <ExportRow sharing={capture.sharing || csvSharing} onImage={capture.startCapture} onCsv={shareCsv} />
              <FlatList
                data={data?.items || []}
                keyExtractor={(item, i) => item.cashmemoNo + i}
                style={styles.modalList}
                renderItem={({ item, index }) => renderBillRow(item, index)}
                ListEmptyComponent={<Text style={styles.emptyText}>No bills found.</Text>}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={7}
                removeClippedSubviews
              />
            </>
          )}
          <Button title="Close" variant="outline" onPress={onClose} style={{ marginTop: spacing(1.5) }} />
        </View>
      </View>

      {/* Off-screen full-list render, only mounted while capturing — the on-screen FlatList above is virtualized (only visible rows exist as native views), so a plain captureRef there would miss everything scrolled out of view. */}
      {capture.capturing && data && (
        <View ref={capture.ref} collapsable={false} style={offscreenCaptureStyle}>
          <Text style={styles.modalTitle}>{data.title}</Text>
          <Text style={styles.modalSub}>
            {data.count} bill{data.count === 1 ? '' : 's'} · {formatValue(data.totalValue)}
            {data.totalQty != null ? ` · ${data.totalQty.toLocaleString('en-IN')} pcs` : ''}
          </Text>
          {data.items.slice(0, MAX_IMAGE_ROWS).map((item, i) => renderBillRow(item, i))}
          {data.items.length > MAX_IMAGE_ROWS && (
            <Text style={styles.captureTruncatedNote}>+{data.items.length - MAX_IMAGE_ROWS} more bills — use Export Excel for the full list</Text>
          )}
        </View>
      )}
    </Modal>
  );
}

/** Item-level breakdown of one tapped row — which articles/colors/sizes make up that salesperson's/category's/etc. total. */
function RowDetailModal({
  visible,
  data,
  loading,
  formatValue,
  onClose,
}: {
  visible: boolean;
  data: RowDetailData | null;
  loading: boolean;
  formatValue: (n: number) => string;
  onClose: () => void;
}) {
  const capture = useCaptureShare(`${safeFilePart(data?.title || 'item-detail')}.png`);
  const [csvSharing, setCsvSharing] = useState(false);
  const [article, setArticle] = useState<SalesReportSegment | null>(null);

  // Clear the article popup whenever the parent modal closes/reopens on a different row.
  useEffect(() => {
    if (!visible) setArticle(null);
  }, [visible]);

  const shareCsv = async () => {
    if (csvSharing || !data) return;
    setCsvSharing(true);
    try {
      const rows = data.segments.map((s) => [s.articleNo ?? s.label, s.brand ?? '', s.color ?? '', s.size ?? '', (s.departments || []).join(', '), s.value, s.qty ?? '']);
      await shareRowsAsCsv(['Article No', 'Brand', 'Color', 'Size', 'Department', 'Value', 'Qty'], rows, `${safeFilePart(data.title)}.csv`);
    } catch {
      Alert.alert('Could not export', 'Please try again.');
    } finally {
      setCsvSharing(false);
    }
  };

  const renderItemRow = (item: SalesReportSegment, i: number) => (
    <Pressable key={item.label + i} style={styles.modalRow} onPress={() => setArticle(item)} disabled={!item.articleNo}>
      {/* Small thumbnail so it's visible from the list which articles already have a picture. */}
      {!!item.imageUrl && <Image source={{ uri: resolveFileUrl(item.imageUrl)! }} style={styles.rowThumb} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.modalRowLabel} numberOfLines={2}>
          {item.label}
        </Text>
        {item.departments && item.departments.length > 0 && (
          <Text style={styles.dayBillBranch} numberOfLines={1}>
            {item.departments.join(', ')}
          </Text>
        )}
      </View>
      {item.qty != null && <Text style={styles.modalRowQty}>{item.qty.toLocaleString('en-IN')} pcs</Text>}
      <Text style={styles.modalRowValue}>{formatValue(item.value)}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* See DayBillsModal's identical comment above — backdrop is a plain
            sibling, not an ancestor of modalBox, so it can never compete with
            the FlatList for the touch responder. */}
        <Pressable style={[StyleSheet.absoluteFill, styles.modalBackdropFill]} onPress={onClose} />
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{data?.title || 'Item Detail'}</Text>
          {loading ? (
            <ActivityIndicator size="large" color={A.primary} style={{ marginVertical: spacing(4) }} />
          ) : (
            <>
              <Text style={styles.modalSub}>
                {formatValue(data?.total || 0)}
                {data?.totalQty != null ? ` · ${data.totalQty.toLocaleString('en-IN')} pcs` : ''}
              </Text>
              <ExportRow sharing={capture.sharing || csvSharing} onImage={capture.startCapture} onCsv={shareCsv} />
              <FlatList
                data={data?.segments || []}
                keyExtractor={(item, i) => item.label + i}
                style={styles.modalList}
                renderItem={({ item, index }) => renderItemRow(item, index)}
                ListEmptyComponent={<Text style={styles.emptyText}>No items found.</Text>}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={7}
                removeClippedSubviews
              />
            </>
          )}
          <Button title="Close" variant="outline" onPress={onClose} style={{ marginTop: spacing(1.5) }} />
        </View>
      </View>

      {/* Rendered as an overlay inside this same Modal rather than a second nested Modal — stacking two RN Modals is unreliable on Android. */}
      {article && <ArticleCard item={article} formatValue={formatValue} onClose={() => setArticle(null)} />}

      {/* Off-screen full-list render, only mounted while capturing — see DayBillsModal's identical comment above. */}
      {capture.capturing && data && (
        <View ref={capture.ref} collapsable={false} style={offscreenCaptureStyle}>
          <Text style={styles.modalTitle}>{data.title}</Text>
          <Text style={styles.modalSub}>
            {formatValue(data.total)}
            {data.totalQty != null ? ` · ${data.totalQty.toLocaleString('en-IN')} pcs` : ''}
          </Text>
          {data.segments.slice(0, MAX_IMAGE_ROWS).map((item, i) => renderItemRow(item, i))}
          {data.segments.length > MAX_IMAGE_ROWS && (
            <Text style={styles.captureTruncatedNote}>+{data.segments.length - MAX_IMAGE_ROWS} more items — use Export Excel for the full list</Text>
          )}
        </View>
      )}
    </Modal>
  );
}

/**
 * Tapped article from RowDetailModal — its picture plus article no / size /
 * color. The picture comes from the shared ArticlePictures table, whether an
 * employee uploaded it from the web portal (/Content/Uploads/..., .NET host)
 * or the app (/uploads/..., Node host) — resolveFileUrl() routes each to its
 * host. No picture (or one that fails to load) shows a placeholder plus a
 * "Request picture" button that notifies the Brand's employees to upload one.
 */
function ArticleCard({ item, formatValue, onClose }: { item: SalesReportSegment; formatValue: (n: number) => string; onClose: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestedMsg, setRequestedMsg] = useState<string | null>(null);
  // Tap the picture -> full-screen view (tap anywhere / ✕ to close).
  const [fullView, setFullView] = useState(false);
  const uri = resolveFileUrl(item.imageUrl);
  const showImage = !!uri && !imageFailed;
  const canRequest = !item.imageUrl && !!item.articleNo && !!item.brandName;

  const requestPicture = async () => {
    if (requesting || !item.articleNo || !item.brandName) return;
    setRequesting(true);
    try {
      const res = await requestArticlePicture({ articleNo: item.articleNo, brandName: item.brandName, color: item.color });
      setRequestedMsg(`Request sent to ${res.data.notified} employee${res.data.notified === 1 ? '' : 's'}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Please try again.';
      if (err?.response?.status === 409) setRequestedMsg(msg);
      else Alert.alert('Could not send request', msg);
    } finally {
      setRequesting(false);
    }
  };

  const details: [string, string | undefined][] = [
    ['Article No', item.articleNo],
    ['Size', item.size],
    ['Color', item.color],
    ['Brand', item.brand],
    ['Department', item.departments?.join(', ')],
  ];

  return (
    <View style={styles.articleRoot}>
      {/* Same sibling-backdrop pattern as the modals above — tap outside the card to close. */}
      <Pressable style={[StyleSheet.absoluteFill, styles.articleBackdropFill]} onPress={onClose} />
      <View style={styles.articleBox}>
        {showImage ? (
          <Pressable onPress={() => setFullView(true)}>
            <Image source={{ uri: uri! }} style={styles.articleImage} resizeMode="contain" onError={() => setImageFailed(true)} />
            <View style={styles.articleZoomHint}>
              <Icon name="search" size={12} color="#fff" />
              <Text style={styles.articleZoomHintText}>Tap to enlarge</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.articleImage, styles.articlePlaceholder]}>
            <Icon name="image" size={48} color={A.muted} strokeWidth={1.5} />
            <Text style={styles.articlePlaceholderText}>No picture available</Text>
          </View>
        )}

        {details.map(([label, value]) => (
          <View key={label} style={styles.articleDetailRow}>
            <Text style={styles.articleDetailLabel}>{label}</Text>
            <Text style={styles.articleDetailValue}>{value || '—'}</Text>
          </View>
        ))}
        <View style={styles.articleDetailRow}>
          <Text style={styles.articleDetailLabel}>Sold</Text>
          <Text style={styles.articleDetailValue}>
            {item.qty != null ? `${item.qty.toLocaleString('en-IN')} pcs · ` : ''}
            {formatValue(item.value)}
          </Text>
        </View>

        {canRequest &&
          (requestedMsg ? (
            <Text style={styles.articleRequestedMsg}>{requestedMsg}</Text>
          ) : (
            <Button title="Request picture" onPress={requestPicture} loading={requesting} style={{ marginTop: spacing(1.5) }} />
          ))}
        <Button title="Close" variant="outline" onPress={onClose} style={{ marginTop: spacing(1.5) }} />
      </View>

      {/* Full-screen picture — an overlay inside the same Modal (not a nested
          RN Modal, which is unreliable on Android), covering the card. */}
      {fullView && showImage && (
        <Pressable style={styles.fullViewRoot} onPress={() => setFullView(false)}>
          <Image source={{ uri: uri! }} style={styles.fullViewImage} resizeMode="contain" />
          <View style={styles.fullViewBar} pointerEvents="box-none">
            <Text style={styles.fullViewTitle} numberOfLines={1}>
              {[item.articleNo, item.color, item.size ? `Size ${item.size}` : ''].filter(Boolean).join(' · ')}
            </Text>
            <Pressable style={styles.fullViewClose} onPress={() => setFullView(false)} hitSlop={10}>
              <Icon name="x" size={20} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/** One row of the week-over-week cascading list — Week N vs Week N-1, newest first; the oldest week in the list has nothing before it to compare against. */
function WeekComparisonCard({ row, formatValue }: { row: WeeklyComparisonRow; formatValue: (n: number) => string }) {
  return (
    <Card style={[styles.weekCard, row.isCurrent && styles.weekCardCurrent]}>
      <View style={styles.weekCardHeader}>
        <Text style={styles.weekCardTitle}>
          Week {row.weekNum} {row.isCurrent ? '(current)' : ''}
        </Text>
        {row.pctChange != null && (
          <View style={[styles.weekBadge, { backgroundColor: row.pctChange >= 0 ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.weekBadgeText, { color: row.pctChange >= 0 ? '#15803d' : '#b91c1c' }]}>
              {row.pctChange >= 0 ? '▲' : '▼'} {Math.abs(row.pctChange)}% vs Wk{row.vsWeekNum}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.weekCardRange}>{row.rangeLabel}</Text>
      <View style={styles.weekCardValueRow}>
        <Text style={styles.weekCardValue}>{formatValue(row.value)}</Text>
        <Text style={styles.weekCardQty}>{row.qty.toLocaleString('en-IN')} pcs</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  filterCard: { marginBottom: spacing(2) },
  filterRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1 },
  deptLabel: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(2) },
  periodBtn: { flex: 1, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  periodBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  periodBtnText: { fontSize: 13, fontWeight: '700', color: A.muted },
  periodBtnTextActive: { color: '#fff' },

  emptyCard: { marginTop: spacing(2) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center' },

  summaryCard: { alignItems: 'center', padding: 18, marginBottom: spacing(2), ...shadow.card },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: A.muted },
  summaryValue: { fontSize: 28, fontWeight: '800', color: A.primary, marginTop: 4 },
  summaryQty: { fontSize: 12, color: A.muted, marginTop: 2 },
  summaryDept: { fontSize: 11.5, color: A.muted, fontWeight: '700', marginTop: 4 },
  pctChange: { fontSize: 12, fontWeight: '700', marginTop: 6 },

  exportRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(1.5) },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: radius.sm, borderWidth: 1.5, borderColor: A.primary },
  exportBtnText: { color: A.primary, fontWeight: '700', fontSize: 12 },
  captureTruncatedNote: { fontSize: 11, color: A.muted, fontStyle: 'italic', textAlign: 'center', padding: 10 },

  chartCard: { padding: 16, borderRadius: radius.md },

  trendCard: { padding: 16, borderRadius: radius.md },

  weekCard: { marginBottom: spacing(1.5), padding: 14 },
  weekCardCurrent: { borderWidth: 1.5, borderColor: A.primary },
  weekCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  weekCardTitle: { fontSize: 13.5, fontWeight: '800', color: A.ink },
  weekBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  weekBadgeText: { fontSize: 11, fontWeight: '700' },
  weekCardRange: { fontSize: 11.5, color: A.muted, marginBottom: 8 },
  weekCardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  weekCardValue: { fontSize: 20, fontWeight: '800', color: A.ink },
  weekCardQty: { fontSize: 13, fontWeight: '700', color: A.muted },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdropFill: { backgroundColor: 'rgba(15,13,35,0.5)' },
  modalBox: { maxHeight: '80%', flexShrink: 1, backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5), overflow: 'hidden' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: 4 },
  modalSub: { fontSize: 12, color: A.muted, marginBottom: spacing(1.5) },
  modalList: { maxHeight: MODAL_LIST_MAX_HEIGHT, flexGrow: 0, flexShrink: 1 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: A.border },
  modalRowLabel: { flex: 1, fontSize: 12.5, color: A.ink, fontWeight: '600' },
  modalRowQty: { fontSize: 12, color: A.muted, fontWeight: '700', minWidth: 56, textAlign: 'right' },
  modalRowValue: { fontSize: 12.5, color: A.ink, fontWeight: '800', textAlign: 'right' },
  dayBillBranch: { fontSize: 10.5, color: A.muted, marginTop: 1 },

  articleRoot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: spacing(2.5) },
  articleBackdropFill: { backgroundColor: 'rgba(15,13,35,0.6)' },
  articleBox: { backgroundColor: A.surface, borderRadius: 20, padding: spacing(2.5) },
  articleImage: { width: '100%', height: 240, borderRadius: radius.md, backgroundColor: A.surfaceRaised, marginBottom: spacing(1.5) },
  articleZoomHint: {
    position: 'absolute',
    right: 8,
    bottom: spacing(1.5) + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  articleZoomHintText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  fullViewRoot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', justifyContent: 'center' },
  fullViewImage: { width: '100%', height: '100%' },
  fullViewBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing(2),
    paddingTop: spacing(5),
    paddingBottom: spacing(1.5),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fullViewTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#fff' },
  fullViewClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  articlePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  articlePlaceholderText: { fontSize: 12, color: A.muted, fontWeight: '600' },
  articleDetailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: A.border },
  articleDetailLabel: { fontSize: 12.5, color: A.muted, fontWeight: '600' },
  articleDetailValue: { flex: 1, fontSize: 13, color: A.ink, fontWeight: '800', textAlign: 'right' },
  rowThumb: { width: 38, height: 38, borderRadius: 8, backgroundColor: A.surfaceRaised },
  articleRequestedMsg: { marginTop: spacing(1.5), fontSize: 12.5, fontWeight: '700', color: '#15803d', textAlign: 'center' },
});
