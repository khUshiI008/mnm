import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import MultiSelectPickerModal, { MultiSelectOption } from '../../components/admin/MultiSelectPickerModal';
import {
  createParty,
  updateParty,
  getParty,
  getPartyLookups,
  checkPartyMobile,
  getFastMovingSessionOptions,
  getCurrentSalePerfSessionOptions,
  getPurchaseMovingSessionOptions,
  PartyPayload,
  PickerOption,
  ExtraDescriptionOption,
} from '../../api/adminPartyApi';

const A = colors.admin;
type PickerKind = 'brands' | 'departments' | 'suppliers' | 'extraDescriptions' | 'fastMovingSessions' | 'currentSalePerfSessions' | 'purchaseMovingSessions' | null;

function isValidMobile(m: string) {
  return /^[0-9]{10}$/.test(m);
}

export default function PartyPanelFormScreen({ params }: { params?: { partyId?: number } }) {
  const { goBack } = useAdminNav();
  const partyId = params?.partyId;
  const isEdit = !!partyId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openPicker, setOpenPicker] = useState<PickerKind>(null);

  const [mobileNo, setMobileNo] = useState('');
  const [mobileWarning, setMobileWarning] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [extraMobileInput, setExtraMobileInput] = useState('');
  const [additionalMobiles, setAdditionalMobiles] = useState<string[]>([]);

  const [brandOptions, setBrandOptions] = useState<PickerOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<PickerOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<PickerOption[]>([]);
  const [extraDescOptionsAll, setExtraDescOptionsAll] = useState<ExtraDescriptionOption[]>([]);
  const [fastMovingSessionOptions, setFastMovingSessionOptions] = useState<PickerOption[]>([]);
  const [currentSalePerfSessionOptions, setCurrentSalePerfSessionOptions] = useState<PickerOption[]>([]);
  const [purchaseMovingSessionOptions, setPurchaseMovingSessionOptions] = useState<PickerOption[]>([]);

  const [brandIds, setBrandIds] = useState<Set<number>>(new Set());
  const [departmentIds, setDepartmentIds] = useState<Set<number>>(new Set());
  const [supplierIds, setSupplierIds] = useState<Set<number>>(new Set());
  const [extraDescIds, setExtraDescIds] = useState<Set<number>>(new Set());
  const [fastMovingSessionIds, setFastMovingSessionIds] = useState<Set<number>>(new Set());
  const [currentSalePerfSessionIds, setCurrentSalePerfSessionIds] = useState<Set<number>>(new Set());
  const [purchaseMovingSessionIds, setPurchaseMovingSessionIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lookupRes, fmsRes, cspsRes, pmsRes] = await Promise.all([
        getPartyLookups(),
        getFastMovingSessionOptions(),
        getCurrentSalePerfSessionOptions(),
        getPurchaseMovingSessionOptions(),
      ]);
      setBrandOptions(lookupRes.data.brands);
      setDepartmentOptions(lookupRes.data.departments);
      setSupplierOptions(lookupRes.data.suppliers);
      setExtraDescOptionsAll(lookupRes.data.extraDescriptions);
      // The per-Party override can only pick Sessions already flagged
      // system-wide (Fast Moving Sessions screen) — each of those carries its
      // own real FastMovingSessionId, unlike the unflagged ones.
      setFastMovingSessionOptions(
        fmsRes.data.sessions.filter((s) => s.flagged && s.fastMovingSessionId != null).map((s) => ({ id: s.fastMovingSessionId as number, name: s.name }))
      );
      // Same "can only pick Sessions already flagged system-wide" rule as
      // Fast Moving Sessions above, this feature's sibling (Current Sale
      // Performance Sessions screen).
      setCurrentSalePerfSessionOptions(
        cspsRes.data.sessions
          .filter((s) => s.flagged && s.currentSalePerfSessionId != null)
          .map((s) => ({ id: s.currentSalePerfSessionId as number, name: s.name }))
      );
      // Same "can only pick Sessions already flagged system-wide" rule as
      // Fast Moving / Current Sale Performance Sessions above, this
      // feature's siblings (Purchase Moving Sessions screen).
      setPurchaseMovingSessionOptions(
        pmsRes.data.sessions
          .filter((s) => s.flagged && s.purchaseMovingSessionId != null)
          .map((s) => ({ id: s.purchaseMovingSessionId as number, name: s.name }))
      );

      if (partyId) {
        const res = await getParty(partyId);
        const p = res.data.party;
        setMobileNo(p.mobileNo);
        setEmail(p.email || '');
        setAdditionalMobiles(p.additionalMobiles);
        setBrandIds(new Set(p.brandIds));
        setDepartmentIds(new Set(p.departmentIds));
        setSupplierIds(new Set(p.supplierIds));
        setFastMovingSessionIds(new Set(p.fastMovingSessionIds));
        setCurrentSalePerfSessionIds(new Set(p.currentSalePerfSessionIds));
        setPurchaseMovingSessionIds(new Set(p.purchaseMovingSessionIds));
        // Extra descriptions are stored as text — map back to the stable
        // index-based ids assigned to extraDescOptionsAll below.
        const textSet = new Set(p.extraDescriptions);
        const ids = lookupRes.data.extraDescriptions.map((_, i) => i).filter((i) => textSet.has(lookupRes.data.extraDescriptions[i].text));
        setExtraDescIds(new Set(ids));
      }
    } catch {
      Alert.alert('Could not load form data');
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Stable id space for extra descriptions = array index into extraDescOptionsAll
  // (loaded once and never reordered during this screen's lifetime), so
  // selection survives the brand-based visibility filter below changing
  // which options are actually shown in the modal.
  const extraDescAllAsOptions: MultiSelectOption[] = useMemo(
    () => extraDescOptionsAll.map((e, i) => ({ id: i, label: e.text })),
    [extraDescOptionsAll]
  );
  const visibleExtraDescOptions: MultiSelectOption[] = useMemo(() => {
    if (!brandIds.size) return [];
    return extraDescAllAsOptions.filter((o) => extraDescOptionsAll[o.id].brandIds.some((bid) => brandIds.has(bid)));
  }, [extraDescAllAsOptions, extraDescOptionsAll, brandIds]);

  // Drop any previously-selected Extra Description that no longer overlaps
  // the current Brand selection — mirrors the server's own re-validation.
  useEffect(() => {
    const visibleIds = new Set(visibleExtraDescOptions.map((o) => o.id));
    setExtraDescIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleExtraDescOptions]);

  const namesFor = (ids: Set<number>, options: PickerOption[]) =>
    options
      .filter((o) => ids.has(o.id))
      .map((o) => o.name)
      .join(', ');

  const checkMobileNow = async (mobile: string) => {
    if (!isValidMobile(mobile)) {
      setMobileWarning(null);
      return;
    }
    try {
      const res = await checkPartyMobile(mobile, partyId);
      setMobileWarning(res.data.taken ? `Already in use by ${res.data.partyLabel}.` : null);
    } catch {
      // Non-blocking check — ignore failures.
    }
  };

  const addExtraMobile = () => {
    const m = extraMobileInput.trim();
    if (!m) return;
    if (!isValidMobile(m)) return Alert.alert('Invalid number', 'Additional mobile numbers must be 10 digits.');
    if (m === mobileNo || additionalMobiles.includes(m)) return Alert.alert('Duplicate number', 'That number is already listed.');
    setAdditionalMobiles((prev) => [...prev, m]);
    setExtraMobileInput('');
    checkMobileNow(m);
  };
  const removeExtraMobile = (m: string) => setAdditionalMobiles((prev) => prev.filter((x) => x !== m));

  const handleSave = async () => {
    if (!isValidMobile(mobileNo)) return Alert.alert('Enter a valid 10-digit Mobile Number.');
    if (!brandIds.size) return Alert.alert('Select at least one Brand.');

    const payload: PartyPayload = {
      mobileNo,
      email: email.trim() || null,
      additionalMobiles,
      brandIds: Array.from(brandIds),
      departmentIds: Array.from(departmentIds),
      supplierIds: Array.from(supplierIds),
      extraDescriptions: Array.from(extraDescIds).map((id) => extraDescOptionsAll[id].text),
      fastMovingSessionIds: Array.from(fastMovingSessionIds),
      currentSalePerfSessionIds: Array.from(currentSalePerfSessionIds),
      purchaseMovingSessionIds: Array.from(purchaseMovingSessionIds),
    };

    setSaving(true);
    try {
      const res = isEdit ? await updateParty(partyId!, payload) : await createParty(payload);
      if (!res.data.success) {
        Alert.alert('Could not save', res.data.errors?.join('\n') || 'Please check the form and try again.');
        return;
      }
      Alert.alert('Saved', `Party ${isEdit ? 'updated' : 'created'} successfully.`);
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
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <TextField
            label="Primary Mobile Number *"
            value={mobileNo}
            onChangeText={setMobileNo}
            onBlur={() => checkMobileNow(mobileNo)}
            keyboardType="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
          />
          {mobileWarning && <Text style={styles.warningText}>{mobileWarning}</Text>}
          <TextField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Additional Mobile Numbers (optional)</Text>
          <View style={styles.addMobileRow}>
            <View style={{ flex: 1 }}>
              <TextField value={extraMobileInput} onChangeText={setExtraMobileInput} keyboardType="numeric" maxLength={10} placeholder="10-digit mobile number" />
            </View>
            <Pressable style={styles.addChipBtn} onPress={addExtraMobile}>
              <Text style={styles.addChipBtnText}>Add</Text>
            </Pressable>
          </View>
          {additionalMobiles.length > 0 && (
            <View style={styles.chipsRow}>
              {additionalMobiles.map((m) => (
                <View key={m} style={styles.chip}>
                  <Text style={styles.chipText}>{m}</Text>
                  <Pressable onPress={() => removeExtraMobile(m)} hitSlop={6}>
                    <Text style={styles.chipRemove}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Data Scope</Text>
          <PickerButton label="Brands *" hint="Required — at least one" value={namesFor(brandIds, brandOptions)} onPress={() => setOpenPicker('brands')} />
          <PickerButton
            label="Departments (optional)"
            hint="Empty = all departments"
            value={namesFor(departmentIds, departmentOptions)}
            onPress={() => setOpenPicker('departments')}
          />
          <PickerButton label="Suppliers (optional)" hint="Empty = all suppliers" value={namesFor(supplierIds, supplierOptions)} onPress={() => setOpenPicker('suppliers')} />
          <PickerButton
            label="Extra Descriptions (optional)"
            hint={brandIds.size ? 'Empty = unrestricted' : 'Select a Brand first'}
            value={Array.from(extraDescIds)
              .map((id) => extraDescOptionsAll[id]?.text)
              .filter(Boolean)
              .join(', ')}
            onPress={() => brandIds.size && setOpenPicker('extraDescriptions')}
          />
          <Text style={styles.hint}>
            When a Party has 1+ Extra Description, its real Brand name is hidden from them everywhere in the Party portal — the Extra
            Description is shown in its place instead (privacy rule).
          </Text>
        </Card>

        <Card style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Fast Moving Session(s)</Text>
          <PickerButton
            label="Fast Moving Session(s) (optional)"
            hint={fastMovingSessionOptions.length ? 'Empty = use the whole-system Fast Moving Session list' : 'No Sessions flagged yet — see Fast Moving Sessions'}
            value={namesFor(fastMovingSessionIds, fastMovingSessionOptions)}
            onPress={() => fastMovingSessionOptions.length && setOpenPicker('fastMovingSessions')}
          />
          <Text style={styles.hint}>
            Overrides the whole-system Fast Moving Session list for this Party only, narrowing it to just the Session(s) picked here. Leave
            empty to keep using the full whole-system list.
          </Text>
        </Card>

        <Card style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Current Sale Performance Session(s)</Text>
          <PickerButton
            label="Current Sale Performance Session(s) (optional)"
            hint={
              currentSalePerfSessionOptions.length
                ? 'Empty = use the whole-system Current Sale Performance Session list'
                : 'No Sessions flagged yet — see Current Sale Performance Sessions'
            }
            value={namesFor(currentSalePerfSessionIds, currentSalePerfSessionOptions)}
            onPress={() => currentSalePerfSessionOptions.length && setOpenPicker('currentSalePerfSessions')}
          />
          <Text style={styles.hint}>
            Overrides the whole-system Current Sale Performance Session list for this Party only, narrowing it to just the Session(s) picked
            here. Leave empty to keep using the full whole-system list.
          </Text>
        </Card>

        <Card style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Purchase Moving Session(s)</Text>
          <PickerButton
            label="Purchase Moving Session(s) (optional)"
            hint={purchaseMovingSessionOptions.length ? 'Empty = use the whole-system Purchase Moving Session list' : 'No Sessions flagged yet — see Purchase Moving Sessions'}
            value={namesFor(purchaseMovingSessionIds, purchaseMovingSessionOptions)}
            onPress={() => purchaseMovingSessionOptions.length && setOpenPicker('purchaseMovingSessions')}
          />
          <Text style={styles.hint}>
            Overrides the whole-system Purchase Moving Session list for this Party only, narrowing it to just the Session(s) picked here.
            Leave empty to keep using the full whole-system list.
          </Text>
        </Card>

        <Button title={isEdit ? 'Save Changes' : 'Create Party'} onPress={handleSave} loading={saving} style={{ marginTop: spacing(2) }} />
      </ScrollView>

      <MultiSelectPickerModal
        visible={openPicker === 'brands'}
        title="Select Brands"
        options={brandOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={brandIds}
        onChange={setBrandIds}
        onClose={() => setOpenPicker(null)}
      />
      <MultiSelectPickerModal
        visible={openPicker === 'departments'}
        title="Select Departments"
        options={departmentOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={departmentIds}
        onChange={setDepartmentIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to include all departments"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'suppliers'}
        title="Select Suppliers"
        options={supplierOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={supplierIds}
        onChange={setSupplierIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to include all suppliers"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'extraDescriptions'}
        title="Select Extra Descriptions"
        options={visibleExtraDescOptions}
        selectedIds={extraDescIds}
        onChange={setExtraDescIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to include all descriptions for the selected Brand(s)"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'fastMovingSessions'}
        title="Select Fast Moving Session(s)"
        options={fastMovingSessionOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={fastMovingSessionIds}
        onChange={setFastMovingSessionIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to use the whole-system Fast Moving Session list"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'currentSalePerfSessions'}
        title="Select Current Sale Performance Session(s)"
        options={currentSalePerfSessionOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={currentSalePerfSessionIds}
        onChange={setCurrentSalePerfSessionIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to use the whole-system Current Sale Performance Session list"
      />
      <MultiSelectPickerModal
        visible={openPicker === 'purchaseMovingSessions'}
        title="Select Purchase Moving Session(s)"
        options={purchaseMovingSessionOptions.map((o) => ({ id: o.id, label: o.name }))}
        selectedIds={purchaseMovingSessionIds}
        onChange={setPurchaseMovingSessionIds}
        onClose={() => setOpenPicker(null)}
        emptyMeansAllHint="Leave empty to use the whole-system Purchase Moving Session list"
      />
    </>
  );
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
  hint: { fontSize: 11, color: A.muted, marginTop: 4, lineHeight: 15 },
  warningText: { fontSize: 11.5, color: '#b45309', marginTop: -10, marginBottom: 12, fontWeight: '600' },

  addMobileRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  addChipBtn: { height: 44, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addChipBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: spacing(1) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: A.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: A.ink },
  chipRemove: { fontSize: 12, color: A.muted, fontWeight: '800' },

  pickerBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: A.border },
  pickerBtnLabel: { fontSize: 12, color: A.muted, marginBottom: 2 },
  pickerBtnValue: { fontSize: 13, color: A.ink, fontWeight: '600' },
  pickerBtnArrow: { fontSize: 20, color: A.muted, marginLeft: 8 },
});
