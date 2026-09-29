import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import DateField from '../../components/DateField';
import AttendanceCalendarModal from '../../components/admin/AttendanceCalendarModal';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  generateReport,
  getDeptDrilldown,
  getFilters,
  PerfDeptDrilldown,
  PerfDeptSection,
  PerfEmpSection,
  PerfFilterOptions,
  PerfSummary,
} from '../../api/adminPerformanceApi';

const A = colors.admin;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function badgeColor(tone: string) {
  return tone === 'green' ? '#15803d' : tone === 'red' ? '#b91c1c' : '#a16207';
}
function fmtValue(v: number, isPercent: boolean, isDecimal: boolean) {
  if (isPercent) return `${v.toFixed(1)}%`;
  if (isDecimal) return v.toFixed(1);
  return String(Math.round(v));
}

export default function PerformanceReportScreen() {
  const today = new Date();
  const start = new Date(today.getTime() - 29 * 86400000);

  const [from, setFrom] = useState(fmtDate(start));
  const [to, setTo] = useState(fmtDate(today));
  const [maxN, setMaxN] = useState('10');
  const [dept, setDept] = useState<{ id: number; name: string } | null>(null);
  const [location, setLocation] = useState<{ id: number; name: string } | null>(null);
  const [category, setCategory] = useState<string>('star');
  const [filters, setFilters] = useState<PerfFilterOptions | null>(null);
  const [pickerOpen, setPickerOpen] = useState<'dept' | 'loc' | null>(null);

  const [summary, setSummary] = useState<PerfSummary | null>(null);
  const [empSections, setEmpSections] = useState<PerfEmpSection[]>([]);
  const [deptSections, setDeptSections] = useState<PerfDeptSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [calendarEmpId, setCalendarEmpId] = useState<number | null>(null);
  const [calendarContext, setCalendarContext] = useState<{ label: string; value: string } | null>(null);
  const [deptDrilldown, setDeptDrilldown] = useState<PerfDeptDrilldown | null>(null);
  const [deptDrilldownLoading, setDeptDrilldownLoading] = useState(false);

  useEffect(() => {
    getFilters().then((r) => setFilters(r.data));
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateReport({
        from,
        to,
        deptId: dept?.id || null,
        locId: location?.id || null,
        maxN: Number(maxN) || 10,
        category: category === 'all' ? null : category,
      });
      setSummary(res.data.summary);
      setEmpSections(res.data.employeeSections);
      setDeptSections(res.data.departmentSections);
      setExpanded({});
    } catch (err: any) {
      setSummary(null);
      setEmpSections([]);
      setDeptSections([]);
      setError(err?.response?.data?.message || 'No attendance data found for the selected period and filters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  /** Tapping a department row inside a "by Department" section — mobile-only, .NET's own department rows aren't clickable at all. */
  const openDeptDrilldown = async (sectionId: string, deptName: string) => {
    const categoryId = sectionId.replace(/^d-/, '');
    setDeptDrilldownLoading(true);
    setDeptDrilldown({ success: true, dept: deptName, categoryId, categoryTitle: deptName, valueLabel: '', isPercent: false, isDecimal: false, rows: [] });
    try {
      const res = await getDeptDrilldown({ from, to, locId: location?.id || null, category: categoryId, dept: deptName });
      setDeptDrilldown(res.data);
    } catch {
      setDeptDrilldown(null);
    } finally {
      setDeptDrilldownLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={generate} />}>
        <View style={styles.filterCard}>
          <View style={styles.dateRow}>
            <DateField granularity="day" value={from} onChange={setFrom} placeholder="From" style={styles.dateFieldWrap} inputStyle={styles.dateFieldInput} />
            <DateField granularity="day" value={to} onChange={setTo} placeholder="To" style={styles.dateFieldWrap} inputStyle={styles.dateFieldInput} />
          </View>
          <View style={styles.dateRow}>
            <Pressable style={styles.pickerBtn} onPress={() => setPickerOpen('dept')}>
              <Text style={styles.pickerBtnText}>{dept ? dept.name : 'All Departments'}</Text>
              <Icon name="chevronDown" size={14} color={A.muted} />
            </Pressable>
            <Pressable style={styles.pickerBtn} onPress={() => setPickerOpen('loc')}>
              <Text style={styles.pickerBtnText}>{location ? location.name : 'All Locations'}</Text>
              <Icon name="chevronDown" size={14} color={A.muted} />
            </Pressable>
          </View>
          <View style={styles.dateRow}>
            <TextInput style={[styles.dateInput, { maxWidth: 90 }]} value={maxN} onChangeText={setMaxN} placeholder="Top N" keyboardType="number-pad" placeholderTextColor={A.muted} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            <CategoryChip label="All" active={category === 'all'} onPress={() => setCategory('all')} />
            {(filters?.categories || []).map((c) => (
              <CategoryChip key={c.id} label={`${c.icon} ${c.title}`} active={category === c.id} onPress={() => setCategory(c.id)} />
            ))}
          </ScrollView>
          <Pressable style={styles.applyBtn} onPress={generate}>
            <Text style={styles.applyBtnText}>{loading ? 'Generating…' : 'Generate Report'}</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {summary && (
          <View style={styles.summaryGrid}>
            <SummaryCard label="Employees" value={String(summary.employees)} />
            <SummaryCard label="Calendar Days" value={String(summary.calendarDays)} />
            <SummaryCard label="Avg Attendance" value={`${summary.avgAttendancePct.toFixed(1)}%`} tone="#15803d" />
            <SummaryCard label="Total Absents" value={String(summary.totalAbsent)} tone="#b91c1c" />
            <SummaryCard label="Total Late Days" value={String(summary.totalLate)} tone="#a16207" />
            <SummaryCard label="Total Early Exits" value={String(summary.totalEarly)} tone="#a16207" />
          </View>
        )}

        {empSections.map((sec) => (
          <View key={sec.id} style={styles.sectionCard}>
            <Pressable style={styles.sectionHeader} onPress={() => toggle(`emp-${sec.id}`)}>
              <View style={[styles.sectionIcon, { backgroundColor: sec.color }]}>
                <Text style={styles.sectionIconText}>{sec.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                <Text style={styles.sectionSub}>{sec.sub}</Text>
              </View>
              <Icon name={expanded[`emp-${sec.id}`] === false ? 'chevronRight' : 'chevronDown'} size={16} color={A.muted} />
            </Pressable>

            {expanded[`emp-${sec.id}`] !== false &&
              sec.rows.map((r) => (
                <Pressable
                  key={r.employeeId}
                  style={styles.empRow}
                  onPress={() => {
                    setCalendarEmpId(r.employeeId);
                    setCalendarContext({ label: sec.valueLabel, value: fmtValue(r.value, sec.isPercent, sec.isDecimal) });
                  }}
                >
                  <Text style={styles.rank}>#{r.rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{r.name}</Text>
                    <Text style={styles.empMeta}>
                      {r.code} · {r.dept} · {r.location}
                    </Text>
                  </View>
                  <View style={styles.empValueBlock}>
                    <Text style={styles.empValue}>{fmtValue(r.value, sec.isPercent, sec.isDecimal)}</Text>
                    <Text style={[styles.empBadge, { color: badgeColor(r.badge[0]) }]}>{r.badge[1]}</Text>
                  </View>
                </Pressable>
              ))}
          </View>
        ))}

        {deptSections.map((sec) => (
          <View key={sec.id} style={styles.sectionCard}>
            <Pressable style={styles.sectionHeader} onPress={() => toggle(`dept-${sec.id}`)}>
              <View style={[styles.sectionIcon, { backgroundColor: sec.color }]}>
                <Text style={styles.sectionIconText}>{sec.icon}</Text>
              </View>
              <Text style={[styles.sectionTitle, { flex: 1 }]}>{sec.title}</Text>
              <Icon name={expanded[`dept-${sec.id}`] === false ? 'chevronRight' : 'chevronDown'} size={16} color={A.muted} />
            </Pressable>

            {expanded[`dept-${sec.id}`] !== false &&
              sec.rows.map((d) => (
                <Pressable key={d.dept} style={styles.deptRow} onPress={() => openDeptDrilldown(sec.id, d.dept)}>
                  <Text style={styles.rank}>#{d.rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{d.dept}</Text>
                    <Text style={styles.empMeta}>{d.empCount} employees</Text>
                  </View>
                  <Text style={styles.empValue}>{fmtValue(d.value, sec.isPercent, false)}</Text>
                  <Icon name="chevronRight" size={14} color={A.muted} />
                </Pressable>
              ))}
          </View>
        ))}
      </ScrollView>

      <PickerModal
        visible={pickerOpen === 'dept'}
        items={filters?.departments || []}
        allLabel="All Departments"
        onSelect={(item) => {
          setDept(item);
          setPickerOpen(null);
        }}
        onClose={() => setPickerOpen(null)}
      />
      <PickerModal
        visible={pickerOpen === 'loc'}
        items={filters?.locations || []}
        allLabel="All Locations"
        onSelect={(item) => {
          setLocation(item);
          setPickerOpen(null);
        }}
        onClose={() => setPickerOpen(null)}
      />

      {calendarEmpId != null && (
        <AttendanceCalendarModal
          visible
          employeeId={calendarEmpId}
          contextLabel={calendarContext?.label}
          contextValue={calendarContext?.value}
          onClose={() => {
            setCalendarEmpId(null);
            setCalendarContext(null);
          }}
        />
      )}

      {deptDrilldown != null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDeptDrilldown(null)}>
          <Pressable style={styles.backdrop} onPress={() => setDeptDrilldown(null)}>
            <Pressable style={styles.drilldownSheet} onPress={() => {}}>
              <View style={styles.drilldownHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drilldownTitle}>{deptDrilldown.dept}</Text>
                  <Text style={styles.sectionSub}>{deptDrilldown.categoryTitle || 'Loading…'}</Text>
                </View>
                <Pressable onPress={() => setDeptDrilldown(null)} style={styles.drilldownClose}>
                  <Icon name="x" size={16} color={A.muted} />
                </Pressable>
              </View>

              {deptDrilldownLoading ? (
                <Text style={styles.errorText}>Loading…</Text>
              ) : deptDrilldown.rows.length === 0 ? (
                <Text style={styles.errorText}>No employees found for this department in the selected period.</Text>
              ) : (
                <FlatList
                  data={deptDrilldown.rows}
                  keyExtractor={(r) => String(r.employeeId)}
                  style={{ maxHeight: 420 }}
                  renderItem={({ item: r }) => (
                    <Pressable
                      style={styles.empRow}
                      onPress={() => {
                        setCalendarEmpId(r.employeeId);
                        setCalendarContext({ label: deptDrilldown.valueLabel, value: fmtValue(r.value, deptDrilldown.isPercent, deptDrilldown.isDecimal) });
                      }}
                    >
                      <Text style={styles.rank}>#{r.rank}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empName}>{r.name}</Text>
                        <Text style={styles.empMeta}>
                          {r.code} · {r.location}
                        </Text>
                      </View>
                      <View style={styles.empValueBlock}>
                        <Text style={styles.empValue}>{fmtValue(r.value, deptDrilldown.isPercent, deptDrilldown.isDecimal)}</Text>
                        <Text style={[styles.empBadge, { color: badgeColor(r.badge[0]) }]}>{r.badge[1]}</Text>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, tone && { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function PickerModal({
  visible,
  items,
  allLabel,
  onSelect,
  onClose,
}: {
  visible: boolean;
  items: { id: number; name: string }[];
  allLabel: string;
  onSelect: (item: { id: number; name: string } | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={() => {}}>
          <Pressable style={styles.pickerRow} onPress={() => onSelect(null)}>
            <Text style={styles.pickerRowText}>{allLabel}</Text>
          </Pressable>
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <Pressable style={styles.pickerRow} onPress={() => onSelect(item)}>
                <Text style={styles.pickerRowText}>{item.name}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  filterCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 14, ...shadow.card },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateInput: { flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: A.ink },
  dateFieldWrap: { flex: 1, marginBottom: 0 },
  dateFieldInput: { borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 0 },
  pickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  pickerBtnText: { fontSize: 12, color: A.ink, fontWeight: '600' },
  chipRow: { flexGrow: 0, flexShrink: 0, marginBottom: 10 },
  chipRowContent: { alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: A.surfaceRaised, marginRight: 6 },
  chipActive: { backgroundColor: A.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: A.muted },
  chipTextActive: { color: '#fff' },
  applyBtn: { backgroundColor: A.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  errorText: { fontSize: 12, color: '#b91c1c', textAlign: 'center', paddingVertical: 16 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  summaryCard: { width: '31%', backgroundColor: A.surface, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', ...shadow.card },
  summaryValue: { fontSize: 15, fontWeight: '800', color: A.ink },
  summaryLabel: { fontSize: 9, color: A.muted, marginTop: 2, fontWeight: '600', textAlign: 'center' },

  sectionCard: { backgroundColor: A.surface, borderRadius: radius.md, marginBottom: 10, overflow: 'hidden', ...shadow.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  sectionIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.ink },
  sectionSub: { fontSize: 10, color: A.muted, marginTop: 1 },

  empRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: A.border },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: A.border },
  rank: { fontSize: 11, fontWeight: '800', color: A.muted, width: 24 },
  empName: { fontSize: 12, fontWeight: '700', color: A.ink },
  empMeta: { fontSize: 10, color: A.muted, marginTop: 1 },
  empValueBlock: { alignItems: 'flex-end' },
  empValue: { fontSize: 13, fontWeight: '800', color: A.ink },
  empBadge: { fontSize: 9, fontWeight: '700', marginTop: 1 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'center', padding: spacing(2) },
  pickerSheet: { backgroundColor: A.surface, borderRadius: radius.md, padding: 12, maxHeight: '60%' },
  pickerRow: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: A.border },
  pickerRowText: { fontSize: 13, color: A.ink, fontWeight: '600' },

  drilldownSheet: { backgroundColor: A.surface, borderRadius: radius.md, maxHeight: '75%', overflow: 'hidden' },
  drilldownHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: A.border },
  drilldownTitle: { fontSize: 15, fontWeight: '800', color: A.ink },
  drilldownClose: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surfaceRaised },
});
