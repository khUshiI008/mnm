import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { getSalesReportsCatalog, SalesReportDef, SalesReportType } from '../../api/adminSalesReportsHubApi';

const A = colors.admin;

const ICON_BY_TYPE: Record<SalesReportType, IconName> = {
  dimension: 'barTrend',
  trend: 'trendingUp',
  progress: 'trendingUp',
  comparison: 'dollar',
};

/**
 * Sales Dashboard — the reports hub (Home -> Sales -> Sales Dashboard). The
 * list itself is fetched from the backend catalog (adminSalesReportsHubService
 * .getReportsCatalog()) rather than hardcoded here, so a new report only
 * needs a service + catalog entry to show up — no app rebuild for the list
 * itself, only for genuinely new detail-screen behavior.
 */
export default function SalesReportsHubScreen() {
  const { navigate } = useAdminNav();
  const [reports, setReports] = useState<SalesReportDef[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSalesReportsCatalog()
      .then((res) => setReports(res.data.reports))
      .catch(() => Alert.alert('Could not load Sales Dashboard', 'Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {(reports || []).map((r) => (
        <Pressable
          key={r.key}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigate('SalesReportDetail', { reportKey: r.key, title: r.title, valueType: r.valueType, reportType: r.type })}
        >
          <View style={styles.iconBadge}>
            <Icon name={ICON_BY_TYPE[r.type] || 'barTrend'} size={20} color={A.primary} />
          </View>
          <Text style={styles.rowLabel}>{r.title}</Text>
          <Icon name="chevronRight" size={18} color={A.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  rowPressed: { opacity: 0.85 },
  iconBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: A.primary + '1f' },
  rowLabel: { flex: 1, fontSize: 14.5, fontWeight: '700', color: A.ink },
});
