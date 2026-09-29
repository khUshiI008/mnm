import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const MAP: Record<string, string> = {
  present: colors.present,
  late: colors.late,
  absent: colors.absent,
  partial: colors.partial,
  weekend: colors.weekend,
  excess: colors.excess,
};

export default function StatusBadge({ statusCss, label }: { statusCss: string; label: string }) {
  const color = MAP[statusCss] || colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: '700' },
});
