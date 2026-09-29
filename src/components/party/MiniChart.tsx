import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Polyline, Rect } from 'react-native-svg';
import { colors, radius, spacing } from '../../theme';

const P = colors.party;
const PALETTE = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#ec4899', '#64748b', '#14b8a6'];

// `label` is the value sent back on selection (a real filterable value, e.g.
// an ISO date for the Day chart); `displayLabel` (defaults to `label`) is
// what's actually shown in the legend.
export type ChartDatum = { label: string; displayLabel?: string; value: number; lyValue?: number | null };
export type ChartType = 'bar' | 'line' | 'pie';

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

function money(n: number) {
  return n >= 1000 || n <= -1000 ? `₹${Math.round(n / 1000)}k` : `₹${Math.round(n)}`;
}

/**
 * Lightweight SVG chart (bar/column, line, pie) with a tappable legend list
 * beneath it — the legend rows are the primary, reliable tap target for
 * cross-filtering (matching Dashboard.aspx's click-to-filter, but without
 * needing pixel-precise taps on tiny SVG shapes on a phone screen). The
 * chart itself is also tappable as a bonus, same effect. "Others (N)" is
 * never tappable — mirrors the .NET reference's own exclusion.
 */
export default function MiniChart({
  data,
  type,
  showLY,
  onSelect,
  selectedLabels,
}: {
  data: ChartDatum[];
  type: ChartType;
  showLY?: boolean;
  onSelect?: (label: string) => void;
  selectedLabels?: Set<string>;
}) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const isOthers = (label: string) => label.startsWith('Others (');
  const tap = (label: string) => {
    if (isOthers(label) || !onSelect) return;
    onSelect(label);
  };

  return (
    <View>
      {type === 'pie' ? (
        <PieVisual data={data} total={total} onSelect={tap} />
      ) : (
        <BarOrLineVisual data={data} type={type} showLY={!!showLY} />
      )}

      <View style={styles.legend}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((Math.max(d.value, 0) / total) * 100) : 0;
          const selected = selectedLabels?.has(d.label);
          const tappable = !isOthers(d.label) && !!onSelect;
          return (
            <Pressable
              key={d.label}
              style={[styles.legendRow, selected && styles.legendRowActive]}
              onPress={() => tap(d.label)}
              disabled={!tappable}
            >
              <View style={[styles.legendDot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {d.displayLabel || d.label}
              </Text>
              <Text style={styles.legendPct}>{pct}%</Text>
              <Text style={styles.legendValue}>{money(d.value)}</Text>
              {showLY && d.lyValue != null && <Text style={styles.legendLy}>LY {money(d.lyValue)}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BarOrLineVisual({ data, type, showLY }: { data: ChartDatum[]; type: ChartType; showLY: boolean }) {
  const height = 140;
  const barWidth = 44;
  const width = Math.max(260, data.length * barWidth);
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.value, d.lyValue || 0)));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={height + 8}>
        {type === 'line' ? (
          <>
            {showLY && data.some((d) => d.lyValue != null) && (
              <Polyline
                points={data.map((d, i) => `${i * barWidth + barWidth / 2},${height - ((d.lyValue || 0) / maxVal) * height}`).join(' ')}
                stroke="#94a3b8"
                strokeWidth={1.5}
                fill="none"
                strokeDasharray="4,3"
              />
            )}
            <Polyline
              points={data.map((d, i) => `${i * barWidth + barWidth / 2},${height - (d.value / maxVal) * height}`).join(' ')}
              stroke={P.primary}
              strokeWidth={2.5}
              fill="none"
            />
            {data.map((d, i) => (
              <Circle key={i} cx={i * barWidth + barWidth / 2} cy={height - (d.value / maxVal) * height} r={3.5} fill={P.primary} />
            ))}
          </>
        ) : (
          data.map((d, i) => {
            const barH = (d.value / maxVal) * height;
            const lyH = d.lyValue != null ? (d.lyValue / maxVal) * height : 0;
            const hasLy = showLY && d.lyValue != null;
            return (
              <G key={i}>
                {hasLy && <Rect x={i * barWidth + 5} y={height - lyH} width={barWidth * 0.32} height={lyH} rx={2} fill="#cbd5e1" />}
                <Rect
                  x={i * barWidth + (hasLy ? barWidth * 0.4 : barWidth * 0.22)}
                  y={height - barH}
                  width={barWidth * 0.32}
                  height={Math.max(barH, 1)}
                  rx={2}
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

function PieVisual({ data, total, onSelect }: { data: ChartDatum[]; total: number; onSelect: (l: string) => void }) {
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
          <Path key={i} d={s.path} fill={s.color} onPress={() => onSelect(s.label)} stroke={P.surface} strokeWidth={1} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: spacing(1) },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderRadius: radius.sm, paddingHorizontal: 6 },
  legendRowActive: { backgroundColor: P.surfaceRaised },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 11.5, color: P.ink, fontWeight: '600' },
  legendPct: { fontSize: 10.5, color: P.muted, width: 34, textAlign: 'right' },
  legendValue: { fontSize: 11, color: P.ink, fontWeight: '700', width: 56, textAlign: 'right' },
  legendLy: { fontSize: 10, color: P.muted, width: 60, textAlign: 'right' },
});
