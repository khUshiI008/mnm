import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const A = colors.admin;

/** Card copy + entry screen key per grantable module — see backend/src/config/permissionModules.js for the source registry. */
const MODULE_CARD: Record<string, { title: string; subtitle: string; icon: IconName; entryKey: string }> = {
  EmployeeRegistration: { title: 'Employee Registrations', subtitle: 'Approve or reject new employee sign-ups', icon: 'personCheck', entryKey: 'EmployeeRegistrations' },
  Employee: { title: 'Employees', subtitle: 'Create, edit and manage employee records', icon: 'twoUsers', entryKey: 'Employees' },
  LeaveApproval: { title: 'Leave Approval', subtitle: 'Approve or reject pending leave requests', icon: 'calendar', entryKey: 'LeaveApproval' },
};

export default function ManageHomeScreen({ onSelectModule }: { onSelectModule: (key: string) => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const moduleKeys = Array.from(new Set((user?.permissions ?? []).map((p) => p.moduleKey)));

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Manage</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {moduleKeys.length === 0 ? (
          <Text style={styles.emptyText}>No manager permissions have been granted to you yet.</Text>
        ) : (
          moduleKeys.map((key) => {
            const card = MODULE_CARD[key];
            if (!card) return null;
            return (
              <Pressable key={key} style={styles.card} onPress={() => onSelectModule(card.entryKey)}>
                <View style={styles.iconWrap}>
                  <Icon name={card.icon} size={22} color={A.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSub}>{card.subtitle}</Text>
                </View>
                <Icon name="chevronRight" size={18} color={A.muted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  header: {
    paddingHorizontal: spacing(2),
    paddingBottom: 10,
    backgroundColor: A.surface,
    borderBottomWidth: 1,
    borderBottomColor: A.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: A.ink },
  content: { padding: spacing(2) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: A.primary + '1a', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: A.ink },
  cardSub: { fontSize: 12, color: A.muted, marginTop: 2 },
});
