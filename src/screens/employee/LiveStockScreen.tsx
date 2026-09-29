import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import { colors, radius, spacing } from '../../theme';
import { getLiveStockBrands, EmployeeBrandOption, DrillFilters } from '../../api/employeeLiveStockApi';
import LiveStockBalanceWidget from '../../components/employee/LiveStockBalanceWidget';
import LiveStockFastMovingWidget from '../../components/employee/LiveStockFastMovingWidget';

const E = colors.emp;

type PeriodMode = 'today' | 'yesterday' | 'week' | 'lastweek' | 'mtd' | 'prevmonth' | '3months';
const PERIOD_OPTIONS: { mode: PeriodMode; label: string }[] = [
  { mode: 'today', label: 'Today' },
  { mode: 'yesterday', label: 'Yesterday' },
  { mode: 'week', label: 'This Week' },
  { mode: 'lastweek', label: 'Last Week' },
  { mode: 'mtd', label: 'This Month' },
  { mode: 'prevmonth', label: 'Last Month' },
  { mode: '3months', label: '3 Months' },
];

/**
 * Node port of Employee/LiveStock.aspx — reached via a "Live Stock" banner on
 * the Employee Dashboard (only shown if resolveEmployeeBrands returns at
 * least one brand). One card per Brand the employee can see via a Sales
 * Target they're personally assigned to OR manage; tapping a brand shows the
 * same Balance Stock drill-down + Fast Moving Products widgets Party/
 * Dashboard.aspx has for that brand.
 */
export default function LiveStockScreen() {
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<EmployeeBrandOption[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('mtd');

  useEffect(() => {
    getLiveStockBrands()
      .then((res) => {
        setBrands(res.data.brands);
        if (res.data.brands.length) setActiveBrandId(res.data.brands[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  if (!brands.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          Live Stock is available once you're assigned to a Sales Target with a Brand — contact admin if you think this is a mistake.
        </Text>
      </View>
    );
  }

  const filters: DrillFilters = { periodMode, brandId: activeBrandId ?? undefined };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(5) }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: spacing(1.5) }}>
        {brands.map((b) => (
          <Pressable
            key={b.id}
            style={[styles.brandPill, activeBrandId === b.id && styles.brandPillActive]}
            onPress={() => setActiveBrandId(b.id)}
          >
            <Text style={[styles.brandPillText, activeBrandId === b.id && styles.brandPillTextActive]} numberOfLines={1}>
              {b.display}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: spacing(2) }}>
        {PERIOD_OPTIONS.map((p) => (
          <Pressable
            key={p.mode}
            style={[styles.periodPill, periodMode === p.mode && styles.periodPillActive]}
            onPress={() => setPeriodMode(p.mode)}
          >
            <Text style={[styles.periodPillText, periodMode === p.mode && styles.periodPillTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ marginBottom: spacing(2) }}>
        <LiveStockBalanceWidget filters={filters} />
      </View>

      <LiveStockFastMovingWidget brandId={activeBrandId ?? undefined} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg, padding: spacing(3) },
  emptyText: { fontSize: 13, color: E.muted, textAlign: 'center', lineHeight: 20 },

  brandPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: E.surface, borderWidth: 1, borderColor: E.border, maxWidth: 180 },
  brandPillActive: { backgroundColor: E.primary, borderColor: E.primary },
  brandPillText: { fontSize: 12.5, fontWeight: '700', color: E.ink },
  brandPillTextActive: { color: '#fff' },

  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: E.surface, borderWidth: 1, borderColor: E.border },
  periodPillActive: { backgroundColor: E.primaryDark, borderColor: E.primaryDark },
  periodPillText: { fontSize: 11.5, fontWeight: '700', color: E.muted },
  periodPillTextActive: { color: '#fff' },
});
