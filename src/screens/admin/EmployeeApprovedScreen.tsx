import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';

const A = colors.admin;

/**
 * Hub screen shown right after approving a registration. Both next-step
 * actions stay reachable no matter which one is done first — each opens as
 * its own screen and returns here via the back arrow (or its own Save),
 * instead of a one-shot alert that loses the other option once tapped.
 */
export default function EmployeeApprovedScreen({ params }: { params?: { employeeId?: number; employeeName?: string } }) {
  const { navigate, goBack } = useAdminNav();
  const employeeId = params?.employeeId;
  const employeeName = params?.employeeName || 'Employee';

  return (
    <View style={styles.screen}>
      <View style={styles.banner}>
        <View style={styles.checkCircle}>
          <Icon name="check" size={22} color="#15803d" />
        </View>
        <Text style={styles.title}>{employeeName} approved</Text>
        <Text style={styles.subtitle}>Set up their shift and fill in the rest of their details whenever you're ready — you can do either one first.</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
        onPress={() => navigate('AssignShift', { employeeId, employeeName, title: 'Assign Shift' })}
      >
        <View style={[styles.actionIcon, { backgroundColor: A.primary + '20' }]}>
          <Icon name="calendar" size={20} color={A.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Assign Shift</Text>
          <Text style={styles.actionSubtitle}>Set which shift they work and from when</Text>
        </View>
        <Icon name="chevronRight" size={18} color={A.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
        onPress={() => navigate('EmployeeForm', { employeeId, title: 'Edit Employee' })}
      >
        <View style={[styles.actionIcon, { backgroundColor: A.primary + '20' }]}>
          <Icon name="gear" size={20} color={A.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Edit Employee Details</Text>
          <Text style={styles.actionSubtitle}>Department, designation, salary, bank details, and more</Text>
        </View>
        <Icon name="chevronRight" size={18} color={A.muted} />
      </Pressable>

      <Button title="Done" variant="outline" onPress={goBack} style={{ marginTop: spacing(3) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg, padding: spacing(2) },
  banner: { alignItems: 'center', marginBottom: spacing(3), marginTop: spacing(2) },
  checkCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#15803d20', alignItems: 'center', justifyContent: 'center', marginBottom: spacing(1.5) },
  title: { fontSize: 17, fontWeight: '800', color: A.ink, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: A.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing(1) },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  actionCardPressed: { opacity: 0.85 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '700', color: A.ink },
  actionSubtitle: { fontSize: 12, color: A.muted, marginTop: 2 },
});
