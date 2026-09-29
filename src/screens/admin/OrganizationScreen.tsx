import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createOrganization,
  deleteOrganization,
  getOrganizationMeta,
  getOrganizations,
  OrganizationMeta,
  OrganizationPayload,
  OrganizationRow,
  updateOrganization,
} from '../../api/adminOrganizationApi';

const A = colors.admin;

export default function OrganizationScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [meta, setMeta] = useState<OrganizationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: OrganizationRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getOrganizations(term);
      setRows(res.data.organizations);
    } catch {
      Alert.alert('Could not load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getOrganizationMeta().then((res) => setMeta(res.data)).catch(() => {});
    load();
  }, [load]);

  const handleDelete = (row: OrganizationRow) => {
    Alert.alert('Archive this organization?', `${row.companyName} will be archived and hidden from active lists.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.organizationId);
          try {
            await deleteOrganization(row.organizationId);
            await load(search || undefined);
          } catch (err: any) {
            Alert.alert('Could not archive', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search organization or company name..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search || undefined)}
          returnKeyType="search"
        />
        <Pressable style={styles.addBtn} onPress={() => setFormTarget({})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{rows.length} organizations</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No organizations found. Tap Add to create the first record.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.organizationId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.organizationName}</Text>
                    <Text style={styles.sub}>{row.companyName}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.detailLine}>{row.ministryDeptAffiliation} · {row.organizationType}</Text>
                <Text style={styles.detailLine}>{row.cityDistrict}, {row.stateUT}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.organizationId}>
                    {busyId === row.organizationId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && meta && (
        <OrgFormModal
          row={formTarget.row}
          meta={meta}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            load(search || undefined);
          }}
        />
      )}
    </View>
  );
}

function OrgFormModal({
  row,
  meta,
  onClose,
  onSaved,
}: {
  row?: OrganizationRow;
  meta: OrganizationMeta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [orgName, setOrgName] = useState(row?.organizationName || '');
  const [ministry, setMinistry] = useState(row?.ministryDeptAffiliation || '');
  const [orgType, setOrgType] = useState(row?.organizationType || '');

  const [companyName, setCompanyName] = useState(row?.companyName || '');
  const [legalName, setLegalName] = useState(row?.legalName || '');
  const [companyCode, setCompanyCode] = useState(row?.companyCode || '');
  const [companyType, setCompanyType] = useState(row?.companyType || '');
  const [industryType, setIndustryType] = useState(row?.industryType || '');
  const [cin, setCin] = useState(row?.cinNumber || '');
  const [pan, setPan] = useState(row?.panNumber || '');
  const [tan, setTan] = useState(row?.tanNumber || '');
  const [gstin, setGstin] = useState(row?.gstin || '');
  const [msme, setMsme] = useState(row?.msmeUdyamNumber || '');
  const [iec, setIec] = useState(row?.iecCode || '');

  const [addr1, setAddr1] = useState(row?.addressLine1 || '');
  const [addr2, setAddr2] = useState(row?.addressLine2 || '');
  const [landmark, setLandmark] = useState(row?.landmark || '');
  const [stateUT, setStateUT] = useState(row?.stateUT || '');
  const [cityDistrict, setCityDistrict] = useState(row?.cityDistrict || '');
  const [pinCode, setPinCode] = useState(row?.pinCode || '');

  const [mobile, setMobile] = useState(row?.mobileNumber || '');
  const [altMobile, setAltMobile] = useState(row?.alternateMobile || '');
  const [landline, setLandline] = useState(row?.landlineNumber || '');
  const [email, setEmail] = useState(row?.emailId || '');
  const [website, setWebsite] = useState(row?.websiteUrl || '');
  const [fax, setFax] = useState(row?.faxNumber || '');

  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: OrganizationPayload = {
      organizationName: orgName,
      ministryDeptAffiliation: ministry,
      organizationType: orgType,
      companyName,
      legalName,
      companyCode,
      companyType,
      industryType,
      cinNumber: cin,
      panNumber: pan,
      tanNumber: tan,
      gstin,
      msmeUdyamNumber: msme,
      iecCode: iec,
      addressLine1: addr1,
      addressLine2: addr2,
      landmark,
      stateUT,
      cityDistrict,
      pinCode,
      mobileNumber: mobile,
      alternateMobile: altMobile,
      landlineNumber: landline,
      emailId: email,
      websiteUrl: website,
      faxNumber: fax,
    };

    setSaving(true);
    try {
      if (isEdit) await updateOrganization(row!.organizationId, payload);
      else await createOrganization(payload);
      Alert.alert('Saved', `Organization ${isEdit ? 'updated' : 'created'} successfully.`);
      onSaved();
    } catch (err: any) {
      const errors: string[] | undefined = err?.response?.data?.errors;
      Alert.alert('Could not save', errors?.join(' ') || err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Organization' : 'Add Organization'}</Text>

            <Text style={styles.sectionTitle}>1. Organization Details</Text>
            <TextField label="Organization Unique Name *" value={orgName} onChangeText={setOrgName} autoCapitalize="characters" />
            <TextField label="Ministry / Dept Affiliation *" value={ministry} onChangeText={setMinistry} />
            <Text style={styles.label}>Organization Type *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={orgType} onValueChange={setOrgType}>
                <Picker.Item label="-- Select Organization Type --" value="" />
                {meta.organizationTypes.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>

            <Text style={styles.sectionTitle}>2. Company Information</Text>
            <TextField label="Company Name *" value={companyName} onChangeText={setCompanyName} />
            <TextField label="Legal Name" value={legalName} onChangeText={setLegalName} />
            <TextField label="Company Code" value={companyCode} onChangeText={setCompanyCode} />
            <Text style={styles.label}>Company Type</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={companyType} onValueChange={setCompanyType}>
                <Picker.Item label="-- Select Company Type --" value="" />
                {meta.companyTypes.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>
            <Text style={styles.label}>Industry Type</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={industryType} onValueChange={setIndustryType}>
                <Picker.Item label="-- Select Industry Type --" value="" />
                {meta.industryTypes.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>
            <TextField label="CIN Number" value={cin} onChangeText={setCin} autoCapitalize="characters" />
            <TextField label="PAN Number" value={pan} onChangeText={setPan} autoCapitalize="characters" />
            <TextField label="TAN Number" value={tan} onChangeText={setTan} autoCapitalize="characters" />
            <TextField label="GSTIN" value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
            <TextField label="MSME / Udyam Number" value={msme} onChangeText={setMsme} />
            <TextField label="IEC Code" value={iec} onChangeText={setIec} />

            <Text style={styles.sectionTitle}>3. Address Information</Text>
            <TextField label="Address Line 1 *" value={addr1} onChangeText={setAddr1} />
            <TextField label="Address Line 2 *" value={addr2} onChangeText={setAddr2} />
            <TextField label="Landmark" value={landmark} onChangeText={setLandmark} />
            <Text style={styles.label}>State / UT *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={stateUT} onValueChange={setStateUT}>
                <Picker.Item label="-- Select State / UT --" value="" />
                {meta.statesAndUTs.map((s) => (
                  <Picker.Item key={s} label={s} value={s} />
                ))}
              </Picker>
            </View>
            <TextField label="City / District *" value={cityDistrict} onChangeText={setCityDistrict} />
            <TextField label="PIN Code *" value={pinCode} onChangeText={setPinCode} keyboardType="number-pad" maxLength={6} />

            <Text style={styles.sectionTitle}>4. Contact Information</Text>
            <TextField label="Mobile Number *" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" maxLength={10} />
            <TextField label="Alternate Mobile" value={altMobile} onChangeText={setAltMobile} keyboardType="phone-pad" maxLength={10} />
            <TextField label="Landline Number" value={landline} onChangeText={setLandline} keyboardType="phone-pad" />
            <TextField label="Email ID *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextField label="Website URL" value={website} onChangeText={setWebsite} autoCapitalize="none" />
            <TextField label="Fax Number" value={fax} onChangeText={setFax} />

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={isEdit ? 'Save Changes' : 'Create'} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },
  topRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  searchInput: { flex: 1, height: 42, borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, backgroundColor: A.surface, paddingHorizontal: 12, color: A.ink, fontSize: 13 },
  addBtn: { height: 42, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 14, fontWeight: '800', color: A.ink },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: A.primary, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(2), marginBottom: spacing(2) },
});
