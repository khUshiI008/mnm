import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { EmployeeBreakdownCategory, EmployeeBreakdownMember, StaffCategory, getEmployeeBreakdown } from '../../api/adminDashboardApi';
import EmployeeQuickEditModal, { QuickEditTarget } from '../../components/admin/EmployeeQuickEditModal';

const A = colors.admin;

const CATEGORY_ORDER: StaffCategory[] = ['Inhouse', 'Brand Staff', 'Other'];

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * "Total Employees" KPI drill-down — Inhouse / Brand Staff tabs (plus an
 * "Other" tab only if any employee falls outside both — e.g. Hold Salary
 * Staff, CN Salary, unset type) up top, each scoped to its own Designation
 * groups -> that group's employee list, same local-state-toggle pattern as
 * MissedPunchesScreen (one API call returns the full nested shape, no
 * second network round-trip when drilling into a group).
 */
export default function EmployeeBreakdownScreen() {
  const [categories, setCategories] = useState<EmployeeBreakdownCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StaffCategory>('Inhouse');
  const [selectedDesignationId, setSelectedDesignationId] = useState<number | 'unspecified' | null>(null);
  const [editTarget, setEditTarget] = useState<QuickEditTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmployeeBreakdown();
      setCategories(res.data.categories);
    } catch {
      Alert.alert('Could not load employee breakdown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = useMemo(() => CATEGORY_ORDER.filter((c) => categories?.some((cat) => cat.category === c)), [categories]);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const activeCategory = categories?.find((c) => c.category === activeTab) || null;
  const currentGroup = activeCategory?.groups.find((g) => g.designationId === selectedDesignationId) || null;

  const changeTab = (t: StaffCategory) => {
    setTab(t);
    setSelectedDesignationId(null); // switching category always lands back on that tab's group list
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  if (!tabs.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No employees found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => changeTab(t)}>
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {!currentGroup ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{activeTab} Employees</Text>
              <Text style={styles.summaryValue}>{activeCategory?.totalEmployees ?? 0}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Salary</Text>
              <Text style={styles.summaryValue}>{money(activeCategory?.totalSalary || 0)}</Text>
            </View>
          </View>

          {!activeCategory || activeCategory.groups.length === 0 ? (
            <Text style={styles.emptyText}>No employees found.</Text>
          ) : (
            activeCategory.groups.map((g) => (
              <Pressable key={String(g.designationId)} style={styles.groupRow} onPress={() => setSelectedDesignationId(g.designationId)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupLabel}>{g.designationLabel}</Text>
                  <Text style={styles.groupSub}>
                    {g.headcount} employee{g.headcount === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.groupRight}>
                  <Text style={styles.groupSalary}>{money(g.totalSalary)}</Text>
                  <Icon name="chevronRight" size={16} color={A.muted} />
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.backRow} onPress={() => setSelectedDesignationId(null)}>
            <Icon name="chevronLeft" size={16} color={A.primary} />
            <Text style={styles.backText}>All groups</Text>
          </Pressable>
          <Text style={styles.detailLabel}>{currentGroup.designationLabel}</Text>
          <Text style={styles.detailSub}>
            {currentGroup.headcount} employee{currentGroup.headcount === 1 ? '' : 's'} · {money(currentGroup.totalSalary)} total
          </Text>

          {currentGroup.employees.map((emp) => (
            <View key={emp.employeeId} style={styles.empRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{emp.name}</Text>
                <Text style={styles.empMeta}>
                  {emp.code}
                  {emp.departmentName ? ` · ${emp.departmentName}` : ''}
                </Text>
              </View>
              <Text style={styles.empSalary}>{emp.salary != null ? money(emp.salary) : '—'}</Text>
              <Pressable style={styles.editBtn} hitSlop={8} onPress={() => setEditTarget(toEditTarget(emp))}>
                <Icon name="gear" size={16} color={A.muted} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <EmployeeQuickEditModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          load();
        }}
      />
    </View>
  );
}

function toEditTarget(emp: EmployeeBreakdownMember): QuickEditTarget {
  return {
    employeeId: emp.employeeId,
    name: emp.name,
    salary: emp.salary,
    designationLookupId: emp.designationLookupId,
    departmentLookupId: emp.departmentLookupId,
    employeeTypeLookupId: emp.employeeTypeLookupId,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  emptyText: { fontSize: 13, color: A.muted, textAlign: 'center', marginTop: spacing(4) },

  tabRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  tabBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  tabBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: A.muted },
  tabBtnTextActive: { color: '#fff' },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 16,
    ...shadow.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: A.border },
  summaryLabel: { fontSize: 11, color: A.muted, fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: A.ink },

  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  groupLabel: { fontSize: 13, fontWeight: '700', color: A.ink },
  groupSub: { fontSize: 11, color: A.muted, marginTop: 2 },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupSalary: { fontSize: 12, color: A.primary, fontWeight: '700' },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { fontSize: 13, fontWeight: '700', color: A.primary },
  detailLabel: { fontSize: 15, fontWeight: '800', color: A.ink },
  detailSub: { fontSize: 12, color: A.muted, marginBottom: 14, marginTop: 2 },

  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: A.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  empName: { fontSize: 13, fontWeight: '800', color: A.ink },
  empMeta: { fontSize: 11, color: A.muted, marginTop: 2 },
  empSalary: { fontSize: 13, fontWeight: '700', color: A.ink, marginRight: 4 },
  editBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
});
