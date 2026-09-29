import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Polyline, Rect } from 'react-native-svg';
import { colors, radius, spacing } from '../../theme';

const A = colors.admin;
export const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b', '#d946ef'];

export type ChartDatum = { label: string; value: number; qty?: number; departments?: string[] };
export type ChartType = 'bar' | 'line' | 'pie';

// A pie with thousands of slices (Category has 2,241 distinct values, Color
// 3,648) is both visually meaningless and, worse, genuinely slow to render —
// each slice is its own SVG <Path>. Top 40 by value covers what a pie chart
// can usefully show; the full list is still available below/in the legend,
// unaffected by this cap.
const PIE_VISUAL_CAP = 40;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

/**
 * Admin-side counterpart to components/party/MiniChart.tsx (SVG pie/bar/line
 * + tappable legend) — kept as its own copy rather than a shared import since
 * admin and party screens already live in separate component trees
 * throughout this app. Powers the Sales Dashboard reports hub's detail
 * screen; the legend list is the reliable tap target on a phone screen, the
 * chart shapes are a tappable bonus.
 *
 * `hideLegend` skips rendering the legend block entirely — used by
 * SalesReportDetailScreen for dimension-type reports, which can have
 * thousands of rows: that screen renders the legend itself via a virtualized
 * FlatList (see LegendRow below) instead of this component's plain
 * `data.map()`, since an un-virtualized list of thousands of native views is
 * what was freezing the JS thread for ~30s on a scroll after opening the
 * report. Every other report type (trend/progress/comparison) has an
 * inherently small, date-bounded list (≤31 days / ≤12 weeks / ≤6 weeks), so
 * it keeps using this component's own built-in legend, unaffected.
 */
export default function MiniChart({
  data,
  type,
  formatValue,
  onSelect,
  hideLegend,
}: {
  data: ChartDatum[];
  type: ChartType;
  formatValue: (n: number) => string;
  onSelect?: (label: string) => void;
  hideLegend?: boolean;
}) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const visualData = type === 'pie' && data.length > PIE_VISUAL_CAP ? [...data].sort((a, b) => b.value - a.value).slice(0, PIE_VISUAL_CAP) : data;

  return (
    <View>
      {type === 'pie' ? (
        <PieVisual data={visualData} total={total} onSelect={onSelect} />
      ) : (
        <BarOrLineVisual data={data} type={type} />
      )}

      {!hideLegend && (
        <View style={styles.legend}>
          {data.map((d, i) => (
            <LegendRow key={d.label + i} item={d} index={i} total={total} showPct={type === 'pie'} formatValue={formatValue} onPress={onSelect} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * One legend row — exported standalone so SalesReportDetailScreen can drive
 * it from a FlatList (virtualized, only renders what's on screen) for
 * dimension-type reports' potentially-huge lists, while MiniChart's own
 * built-in legend (above) still uses it directly for small lists.
 */
export function LegendRow({
  item,
  index,
  total,
  showPct,
  formatValue,
  onPress,
}: {
  item: ChartDatum;
  index: number;
  total: number;
  showPct: boolean;
  formatValue: (n: number) => string;
  onPress?: (label: string) => void;
}) {
  const pct = showPct && total > 0 ? Math.round((Math.max(item.value, 0) / total) * 100) : 0;
  const tappable = showPct && !!onPress;
  return (
    <Pressable style={styles.legendRow} onPress={() => onPress?.(item.label)} disabled={!tappable}>
      <View style={[styles.legendDot, { backgroundColor: PALETTE[index % PALETTE.length] }]} />
      <View style={styles.legendLabelCol}>
        <Text style={styles.legendLabelText} numberOfLines={1}>
          {item.label}
        </Text>
        {item.departments && item.departments.length > 0 && (
          <Text style={styles.legendDept} numberOfLines={1}>
            {item.departments.join(', ')}
          </Text>
        )}
      </View>
      {item.qty != null && (
        <Text style={styles.legendQtyMid} numberOfLines={1}>
          {item.qty.toLocaleString('en-IN')} pcs
        </Text>
      )}
      <Text style={styles.legendValue}>
        {showPct && <Text style={styles.legendPctInline}>{pct}%  </Text>}
        {formatValue(item.value)}
      </Text>
    </Pressable>
  );
}

function BarOrLineVisual({ data, type }: { data: ChartDatum[]; type: ChartType }) {
  const height = 140;
  const barWidth = 52;
  const width = Math.max(280, data.length * barWidth);
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={height + 8}>
        {type === 'line' ? (
          <>
            <Polyline
              points={data.map((d, i) => `${i * barWidth + barWidth / 2},${height - (d.value / maxVal) * height}`).join(' ')}
              stroke={A.primary}
              strokeWidth={2.5}
              fill="none"
            />
            {data.map((d, i) => (
              <Circle key={i} cx={i * barWidth + barWidth / 2} cy={height - (d.value / maxVal) * height} r={3.5} fill={A.primary} />
            ))}
          </>
        ) : (
          data.map((d, i) => {
            const barH = (d.value / maxVal) * height;
            return (
              <G key={i}>
                <Rect
                  x={i * barWidth + barWidth * 0.22}
                  y={height - barH}
                  width={barWidth * 0.56}
                  height={Math.max(barH, 1)}
                  rx={3}
                  fill={PALETTE[i % PALETTE.length]}
                />
              </G>
            );
          })
        )}
      </Svg>
    </ScrollView>
  );
}

function PieVisual({ data, total, onSelect }: { data: ChartDatum[]; total: number; onSelect?: (l: string) => void }) {
  const cx = 90;
  const cy = 90;
  const r = 70;
  let angle = -90;
  const slices = data.map((d, i) => {
    const value = Math.max(d.value, 0);
    const sweep = (value / total) * 360;
    const start = angle;
    const end = angle + (sweep || 0.001);
    angle = end;
    return { path: describeArc(cx, cy, r, start, end), color: PALETTE[i % PALETTE.length], label: d.label };
  });
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={180} height={180}>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} onPress={() => onSelect?.(s.label)} stroke={A.surface} strokeWidth={1} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: spacing(2) },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderRadius: radius.sm, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: A.border },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12.5, color: A.ink, fontWeight: '600' },
  legendLabelCol: { flex: 1 },
  legendLabelText: { fontSize: 12.5, color: A.ink, fontWeight: '600' },
  legendDept: { fontSize: 10.5, color: A.muted, marginTop: 1 },
  // Same font size/weight as legendValue (the price) — pcs comes FIRST, its
  // own column between the label and the pct+price column.
  legendQtyMid: { fontSize: 12.5, color: A.ink, fontWeight: '800', textAlign: 'right', minWidth: 56 },
  legendValue: { fontSize: 12.5, color: A.ink, fontWeight: '800', textAlign: 'right' },
  // pct rendered inline INSIDE legendValue (nested Text), right before the
  // price, so they read together as one "4%  ₹4,66,014" group.
  legendPctInline: { fontSize: 11, color: A.muted, fontWeight: '600' },
});
