import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import DateField from '../../components/DateField';
import { colors, radius, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';
import { getEmployees } from '../../api/employeeApi';
import {
  createTarget,
  DayRow,
  getTarget,
  getTargetLookups,
  PickerOption,
  SlabRow,
  TargetPayload,
  updateTarget,
} from '../../api/adminTargetGenerateApi';

const A = colors.admin;
const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_DAYS: DayRow[] = [
  { day: 'Mon', valueMultiplier: 0.84, qtyMultiplier: 0.84, valueReward: 0, qtyReward: 0 },
  { day: 'Tue', valueMultiplier: 0.84, qtyMultiplier: 0.84, valueReward: 0, qtyReward: 0 },
  { day: 'Wed', valueMultiplier: 0.84, qtyMultiplier: 0.84, valueReward: 0, qtyReward: 0 },
  { day: 'Thu', valueMultiplier: 0.84, qtyMultiplier: 0.84, valueReward: 0, qtyReward: 0 },
  { day: 'Fri', valueMultiplier: 1.0, qtyMultiplier: 1.0, valueReward: 0, qtyReward: 0 },
  { day: 'Sat', valueMultiplier: 1.25, qtyMultiplier: 1.25, valueReward: 0, qtyReward: 0 },
  { day: 'Sun', valueMultiplier: 1.4, qtyMultiplier: 1.4, valueReward: 0, qtyReward: 0 },
];

type PickerKind = 'brands' | 'departments' | 'branches' | 'employees' | 'managers' | null;

function formatDisplayDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// MultiSelectPickerModal renders {id,label,sub?} rows — PickerOption from the lookups
// API is {id,name} instead, so without this conversion the brand/department/branch
// picker rows would render blank labels (employees/managers already build their own
// {id,label,sub} shape directly, see employeeOptions below, so only these three need it).
function asPickerOptions(options: PickerOption[]): MultiSelectOption[] {
  return options.map((o) => ({ id: o.id, label: o.name }));
}

export default function TargetGenerateFormScreen({ params }: { params?: { salesTargetId?: number; duplicateFromId?: number } }) {
  const { goBack } = useAdminNav();
  const salesTargetId = params?.salesTargetId;
  const isEdit = !!salesTargetId;
  // "New Target from this" — a create, pre-filled from an existing target,
  // that closes the source out (EffectiveTo) once saved. See
  // adminSalesTargetService.js's duplicateFromId handling.
  const duplicateFromId = !isEdit ? params?.duplicateFromId : undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dayTab, setDayTab] = useState<'value' | 'qty'>('value');
  const [openPicker, setOpenPicker] = useState<PickerKind>(null);
  const [sourceEffectiveFrom, setSourceEffectiveFrom] = useState<string | null>(null);

  const [targetName, setTargetName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [managerTargetMode, setManagerTargetMode] = useState<'Single' | 'Multiple'>('Single');
  const [weekStartDay, setWeekStartDay] = useState('Monday');
  const [weeklyTargetValue, setWeeklyTargetValue] = useState('0');
  const [weeklyTargetQty, setWeeklyTargetQty] = useState('0');
  const [days, setDays] = useState<DayRow[]>(DEFAULT_DAYS);
  const [qtyRewardPerPcs, setQtyRewardPerPcs] = useState('0');
  const [salesScope, setSalesScope] = useState<'Personal' | 'Overall'>('Personal');
  const [monthlyTargetValue, setMonthlyTargetValue] = useState('');
  const [monthlyTargetQty, setMonthlyTargetQty] = useState('');
  const [rewardPoolValue, setRewardPoolValue] = useState('');
  const [rewardPoolQty, setRewardPoolQty] = useState('');
  const [slabs, setSlabs] = useState<SlabRow[]>([]);
  const [managerSlabs, setManagerSlabs] = useState<SlabRow[]>([]);

  const [brandOptions, setBrandOptions] = useState<PickerOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<PickerOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<PickerOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<MultiSelectOption[]>([]);

  const [brandIds, setBrandIds] = useState<Set<number>>(new Set());
  const [departmentIds, setDepartmentIds] = useState<Set<number>>(new Set());
  const [branchIds, setBranchIds] = useState<Set<number>>(new Set());
  const [employeeIds, setEmployeeIds] = useState<Set<number>>(new Set());
  const [managerIds, setManagerIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lookupRes, empRes] = await Promise.all([getTargetLookups(), getEmployees({ pageSize: 2000, sortCol: 'EmployeeName' })]);
      setBrandOptions(lookupRes.data.brands);
      setDepartmentOptions(lookupRes.data.departments);
      setBranchOptions(lookupRes.data.branches);
      setEmployeeOptions(empRes.data.employees.map((e) => ({ id: e.employeeId, label: e.employeeName, sub: e.code })));

      if (salesTargetId || duplicateFromId) {
        const res = await getTarget((salesTargetId || duplicateFromId)!);
        const t = res.data.target;
        setTargetName(t.targetName);
        // Duplicate flow: leave Effective From blank — it must be a new
        // date strictly after the source's own Effective From, so we don't
        // pre-fill a value the server would reject unchanged.
        setEffectiveFrom(duplicateFromId ? '' : (t.effectiveFrom || '').slice(0, 10));
        if (duplicateFromId) setSourceEffectiveFrom((t.effectiveFrom || '').slice(0, 10));
        setWeekStartDay(t.weekStartDay);
        setManagerTargetMode(t.managerTargetMode === 'Multiple' ? 'Multiple' : 'Single');
        setWeeklyTargetValue(String(t.weeklyTargetValue));
        setWeeklyTargetQty(String(t.weeklyTargetQty));
        setDays(t.days.length ? t.days : DEFAULT_DAYS);
        setQtyRewardPerPcs(String(t.qtyRewardPerPcs));
        setSalesScope(t.salesScope);
        setMonthlyTargetValue(t.monthlyTargetValue != null ? String(t.monthlyTargetValue) : '');
        setMonthlyTargetQty(t.monthlyTargetQty != null ? String(t.monthlyTargetQty) : '');
        setRewardPoolValue(t.rewardPoolValue != null ? String(t.rewardPoolValue) : '');
        setRewardPoolQty(t.rewardPoolQty != null ? String(t.rewardPoolQty) : '');
        setSlabs(t.slabs);
        setManagerSlabs(t.managerSlabs);
        setBrandIds(new Set(t.brandIds));
        setDepartmentIds(new Set(t.departmentIds));
        setBranchIds(new Set(t.branchIds));
        setEmployeeIds(new Set(t.employeeIds));
        setManagerIds(new Set(t.managerIds));
      }
    } catch {
      Alert.alert('Could not load form data');
    } finally {
      setLoading(false);
    }
  }, [salesTargetId, duplicateFromId]);

  useEffect(() => {
    load();
  }, [load]);

  const setDayField = (idx: number, field: keyof DayRow, value: number) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };

  const addSlab = () => setSlabs((prev) => [...prev, { achievementPct: 0, valueReward: 0, qtyReward: 0 }]);
  const removeSlab = (idx: number) => setSlabs((prev) => prev.filter((_, i) => i !== idx));
  const setSlabField = (idx: number, field: keyof SlabRow, value: number) => {
    setSlabs((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addManagerSlab = () => setManagerSlabs((prev) => [...prev, { achievementPct: 0, valueReward: 0, qtyReward: 0 }]);
  const removeManagerSlab = (idx: number) => setManagerSlabs((prev) => prev.filter((_, i) => i !== idx));
  const setManagerSlabField = (idx: number, field: keyof SlabRow, value: number) => {
    setManagerSlabs((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const namesFor = (ids: Set<number>, options: PickerOption[] | MultiSelectOption[]) =>
    options
      .filter((o) => ids.has(o.id))
      .map((o) => ('name' in o ? o.name : o.label))
      .join(', ');

  const handleSave = async () => {
    if (duplicateFromId && sourceEffectiveFrom && effectiveFrom && effectiveFrom <= sourceEffectiveFrom) {
      Alert.alert('Invalid date', `New Effective From date must be after the existing target's Effective From date (${formatDisplayDate(sourceEffectiveFrom)}).`);
      return;
    }

    const payload: TargetPayload = {
      targetName,
      effectiveFrom,
      managerTargetMode,
      weekStartDay,
      weeklyTargetValue: Number(weeklyTargetValue) || 0,
      weeklyTargetQty: Number(weeklyTargetQty) || 0,
      days,
      qtyRewardPerPcs: Number(qtyRewardPerPcs) || 0,
      salesScope,
      monthlyTargetValue: monthlyTargetValue.trim() ? Number(monthlyTargetValue) : null,
      monthlyTargetQty: monthlyTargetQty.trim() ? Number(monthlyTargetQty) : null,
      rewardPoolValue: rewardPoolValue.trim() ? Number(rewardPoolValue) : null,
      rewardPoolQty: rewardPoolQty.trim() ? Number(rewardPoolQty) : null,
      brandIds: Array.from(brandIds),
      departmentIds: Array.from(departmentIds),
      branchIds: Array.from(branchIds),
      employeeIds: Array.from(employeeIds),
      managerIds: Array.from(managerIds),
      slabs,
      managerSlabs,
    };
    if (duplicateFromId) payload.duplicateFromId = duplicateFromId;

    setSaving(true);
    try {
      const res = isEdit ? await updateTarget(salesTargetId!, payload) : await createTarget(payload);
      if (!res.data.success) {
        Alert.alert('Could not save', res.data.errors?.join('\n') || 'Please check the form and try again.');
        return;
      }
      Alert.alert('Saved', res.data.message || `Target ${isEdit ? 'updated' : 'created'} successfully.`);
      goBack();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join('\n') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <SectionCard title="Basics">
          {duplicateFromId && (
            <View style={styles.duplicateBanner}>
              <Text style={styles.duplicateBannerText}>
                New Target from this — the existing target (from {sourceEffectiveFrom ? formatDisplayDate(sourceEffectiveFrom) : '…'}) will be closed out the
                day before whatever Effective From date you pick below.
              </Text>
            </View>
          )}
          <TextField label="Target Name *" value={targetName} onChangeText={setTargetName} maxLength={200} />
          <DateField label="Effective From *" granularity="day" value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Select date" />
          {duplicateFromId && sourceEffectiveFrom && (
            <Text style={styles.hint}>Must be after {formatDisplayDate(sourceEffectiveFrom)} (the existing target's Effective From).</Text>
          )}
          <Text style={styles.label}>Week Start Day</Text>
          <PickerWrap>
            <Picker selectedValue={weekStartDay} onValueChange={(v) => setWeekStartDay(String(v))}>
              {WEEK_DAYS.map((d) => (
                <Picker.Item key={d} label={d} value={d} />
              ))}
            </Picker>
          </PickerWrap>

          <Text style={styles.label}>Sales Scope</Text>
          <View style={styles.scopeRow}>
            {(['Personal', 'Overall'] as const).map((s) => (
              <Pressable key={s} style={[styles.scopePill, salesScope === s && styles.scopePillActive]} onPress={() => setSalesScope(s)}>
                <Text style={[styles.scopePillText, salesScope === s && styles.scopePillTextActive]}>
                  {s === 'Personal' ? 'Personal Sale' : 'Overall Brand Sale'}
                </Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Weekly Targets">
          <TextField label="Weekly Target Value (₹)" value={weeklyTargetValue} onChangeText={setWeeklyTargetValue} keyboardType="numeric" />
          <TextField label="Weekly Target Qty" value={weeklyTargetQty} onChangeText={setWeeklyTargetQty} keyboardType="numeric" />
          <TextField label="Qty Reward Per Piece (₹)" value={qtyRewardPerPcs} onChangeText={setQtyRewardPerPcs} keyboardType="numeric" />
          <Text style={styles.hint}>Optional monthly convenience fields — used for the Monthly Pacing panel; weekly targets remain the source of truth.</Text>
          <TextField label="Monthly Target Value (optional)" value={monthlyTargetValue} onChangeText={setMonthlyTargetValue} keyboardType="numeric" />
          <TextField label="Monthly Target Qty (optional)" value={monthlyTargetQty} onChangeText={setMonthlyTargetQty} keyboardType="numeric" />
          <TextField label="Reward Pool Value (optional)" value={rewardPoolValue} onChangeText={setRewardPoolValue} keyboardType="numeric" />
          <TextField label="Reward Pool Qty (optional)" value={rewardPoolQty} onChangeText={setRewardPoolQty} keyboardType="numeric" />
        </SectionCard>

        <SectionCard title="Day-wise Multipliers & Rewards">
          <View style={styles.dayTabRow}>
            {(['value', 'qty'] as const).map((tab) => (
              <Pressable key={tab} style={[styles.dayTab, dayTab === tab && styles.dayTabActive]} onPress={() => setDayTab(tab)}>
                <Text style={[styles.dayTabText, dayTab === tab && styles.dayTabTextActive]}>{tab === 'value' ? 'Value Targets' : 'Qty Targets'}</Text>
              </Pressable>
            ))}
          </View>
          {days.map((d, i) => (
            <View key={d.day} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{d.day}</Text>
              <View style={styles.dayInputWrap}>
                <Text style={styles.dayInputLabel}>Multiplier</Text>
                <TextField
                  value={String(dayTab === 'value' ? d.valueMultiplier : d.qtyMultiplier)}
                  onChangeText={(v) => setDayField(i, dayTab === 'value' ? 'valueMultiplier' : 'qtyMultiplier', Number(v) || 0)}
                  keyboardType="numeric"
                  style={styles.dayInput}
                />
              </View>
              <View style={styles.dayInputWrap}>
                <Text style={styles.dayInputLabel}>Day Reward (₹)</Text>
                <TextField
                  value={String(dayTab === 'value' ? d.valueReward : d.qtyReward)}
                  onChangeText={(v) => setDayField(i, dayTab === 'value' ? 'valueReward' : 'qtyReward', Number(v) || 0)}
                  keyboardType="numeric"
                  style={styles.dayInput}
                />
              </View>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Assignments">
          <PickerButton label="Brands *" hint="Required — at least one" value={namesFor(brandIds, brandOptions)} onPress={() => setOpenPicker('brands')} />
          <PickerButton label="Departments" hint="Empty = all departments" value={namesFor(departmentIds, departmentOptions)} onPress={() => setOpenPicker('departments')} />
          <PickerButton label="Branches" hint="Empty = all branches" value={namesFor(branchIds, branchOptions)} onPress={() => setOpenPicker('branches')} />
          <PickerButton label="Employees" hint="Assigned to this target" value={namesFor(employeeIds, employeeOptions)} onPress={() => setOpenPicker('employees')} />
          <PickerButton label="Managers" hint="Get team-overview visibility" value={namesFor(managerIds, employeeOptions)} onPress={() => setOpenPicker('managers')} />

          <Text style={styles.label}>Target Mode for Selected Manager(s)</Text>
          <View style={styles.scopeRow}>
            {(['Single', 'Multiple'] as const).map((m) => (
              <Pressable key={m} style={[styles.scopePill, managerTargetMode === m && styles.scopePillActive]} onPress={() => setManagerTargetMode(m)}>
                <Text style={[styles.scopePillText, managerTargetMode === m && styles.scopePillTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            {managerTargetMode === 'Multiple' && managerIds.size > 1
              ? `Multiple will save this as ${managerIds.size} separate individual manager targets, one per manager.`
              : 'Multiple only splits into separate targets when 2+ managers are selected above — otherwise it is recorded as a flag only.'}
          </Text>
        </SectionCard>

        <SectionCard title="Achievement Slabs">
          <Text style={styles.hint}>Highest slab the person qualifies for applies. Value Reward is a % of Weekly Target Value; Qty Reward is a ₹ rate per unit sold.</Text>
          {slabs.map((s, i) => (
            <View key={i} style={styles.slabRow}>
              <View style={styles.slabField}>
                <Text style={styles.dayInputLabel}>Achievement %</Text>
                <TextField value={String(s.achievementPct)} onChangeText={(v) => setSlabField(i, 'achievementPct', Number(v) || 0)} keyboardType="numeric" style={styles.dayInput} />
              </View>
              <View style={styles.slabField}>
                <Text style={styles.dayInputLabel}>Value Reward (%)</Text>
                <TextField value={String(s.valueReward)} onChangeText={(v) => setSlabField(i, 'valueReward', Number(v) || 0)} keyboardType="numeric" style={styles.dayInput} />
              </View>
              <View style={styles.slabField}>
                <Text style={styles.dayInputLabel}>Qty Reward (₹)</Text>
                <TextField value={String(s.qtyReward)} onChangeText={(v) => setSlabField(i, 'qtyReward', Number(v) || 0)} keyboardType="numeric" style={styles.dayInput} />
              </View>
              <Pressable style={styles.slabRemoveBtn} onPress={() => removeSlab(i)}>
                <Text style={styles.slabRemoveText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addSlabBtn} onPress={addSlab}>
            <Text style={styles.addSlabText}>+ Add Slab</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="Manager Achievement Slabs" last>
          <Text style={styles.hint}>Highest slab the manager qualifies for applies. Value Reward is a % of Weekly Target Value; Qty Reward is a ₹ rate per unit sold.</Text>
          {managerSlabs.map((s, i) => (
            <View key={i} style={styles.slabRow}>
              <View style={styles.slabField}>
                <Text style={styles.dayInputLabel}>Achievement %</Text>
                <TextField value={String(s.achievementPct)} onChangeText={(v) => setManagerSlabField(i, 'achievementPct', Number(v) || 0)} keyboardType="numeric" style={styles.dayInput} />
              </View>
              <View style={styles.slabField}>
                <Text style={styles.dayInputLabel}>Value Reward (%)</Text>
                <TextField value={String(s.valueReward)} onChangeText={(v) => setManagerSlabField(i, 'valueReward', Number(v) || 0)} keyboardType="numeric" style={styles.dayInput} />
              </View>
              <View style={styles.slabField}>
                <Text style={styles.dayInputLabel}>Qty Reward (₹)</Text>
                <TextField value={String(s.qtyReward)} onChangeText={(v) => setManagerSlabField(i, 'qtyReward', Number(v) || 0)} keyboardType="numeric" style={styles.dayInput} />
              </View>
              <Pressable style={styles.slabRemoveBtn} onPress={() => removeManagerSlab(i)}>
                <Text style={styles.slabRemoveText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addSlabBtn} onPress={addManagerSlab}>
            <Text style={styles.addSlabText}>+ Add Slab</Text>
          </Pressable>
        </SectionCard>

        <Button
          title={isEdit ? 'Save Changes' : duplicateFromId ? 'Create & Close Out Previous' : 'Create Target'}
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing(1) }}
        />
      </ScrollView>

      <MultiSelectPickerModal
        visible={openPicker === 'brands'}
        title="Select Brands"
        options={asPickerOptions(brandOptions)}
        selectedIds={brandIds}
        onChange={setBrandIds}
        onClose={() => setOpenPicker(null)}
      />
      <MultiSelectPickerModal
        visible={openPicker === 'departments'}
        title="Select Departments"
        options={asPickerOptions(departmentOptions)}
        selectedIds={departmentIds}
        onChange={setDepartmentIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to include all departments"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'branches'}
        title="Select Branches"
        options={asPickerOptions(branchOptions)}
        selectedIds={branchIds}
        onChange={setBranchIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to include all branches"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'employees'}
        title="Select Employees"
        options={employeeOptions}
        selectedIds={employeeIds}
        onChange={setEmployeeIds}
        onClose={() => setOpenPicker(null)}
      />
      <MultiSelectPickerModal
        visible={openPicker === 'managers'}
        title="Select Managers"
        options={employeeOptions}
        selectedIds={managerIds}
        onChange={setManagerIds}
        onClose={() => setOpenPicker(null)}
      />
    </>
  );
}

function SectionCard({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <Card style={[styles.sectionCard, last && { marginBottom: 0 }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function PickerWrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.pickerWrap}>{children}</View>;
}

function PickerButton({ label, hint, value, onPress }: { label: string; hint: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.pickerBtn} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pickerBtnLabel}>{label}</Text>
        <Text style={styles.pickerBtnValue} numberOfLines={1}>
          {value || hint}
        </Text>
      </View>
      <Text style={styles.pickerBtnArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },
  sectionCard: { marginBottom: spacing(2), borderRadius: radius.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  hint: { fontSize: 11, color: A.muted, marginBottom: spacing(1.5) },
  duplicateBanner: { backgroundColor: A.primary + '12', borderRadius: radius.sm, borderWidth: 1, borderColor: A.primary + '40', padding: 10, marginBottom: spacing(1.5) },
  duplicateBannerText: { fontSize: 11.5, color: A.ink, lineHeight: 16 },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },

  scopeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  scopePill: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: A.border, alignItems: 'center' },
  scopePillActive: { backgroundColor: A.primary, borderColor: A.primary },
  scopePillText: { fontSize: 12, fontWeight: '700', color: A.ink },
  scopePillTextActive: { color: '#fff' },

  dayTabRow: { flexDirection: 'row', backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 3, marginBottom: spacing(1.5) },
  dayTab: { flex: 1, paddingVertical: 8, borderRadius: radius.sm - 2, alignItems: 'center' },
  dayTabActive: { backgroundColor: A.primary },
  dayTabText: { fontSize: 12, fontWeight: '700', color: A.muted },
  dayTabTextActive: { color: '#fff' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayLabel: { width: 40, fontSize: 12, fontWeight: '700', color: A.ink },
  dayInputWrap: { flex: 1 },
  dayInputLabel: { fontSize: 10, color: A.muted, marginBottom: 2 },
  dayInput: { paddingVertical: 8, paddingHorizontal: 10, fontSize: 12, marginBottom: 0 },

  pickerBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: A.border },
  pickerBtnLabel: { fontSize: 12, color: A.muted, marginBottom: 2 },
  pickerBtnValue: { fontSize: 13, color: A.ink, fontWeight: '600' },
  pickerBtnArrow: { fontSize: 20, color: A.muted, marginLeft: 8 },

  slabRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  slabField: { flex: 1 },
  slabRemoveBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  slabRemoveText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  addSlabBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: A.primary, borderStyle: 'dashed' },
  addSlabText: { color: A.primary, fontWeight: '700', fontSize: 13 },
});
