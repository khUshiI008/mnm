import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '../../components/AppPicker';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createLocation,
  deleteLocation,
  getLocationOrganizationOptions,
  getLocations,
  LocationOrgOption,
  LocationPayload,
  LocationRow,
  updateLocation,
} from '../../api/adminLocationApi';

const A = colors.admin;

export default function LocationScreen() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<LocationOrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<{ row?: LocationRow } | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      const res = await getLocations(term);
      setRows(res.data.locations);
    } catch {
      Alert.alert('Could not load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getLocationOrganizationOptions().then((res) => setOrgOptions(res.data.organizations)).catch(() => {});
    load();
  }, [load]);

  const handleDelete = (row: LocationRow) => {
    Alert.alert('Archive this location?', `${row.locationName} will be archived and hidden from active lists.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.locationId);
          try {
            await deleteLocation(row.locationId);
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
          placeholder="Search location, code or organization..."
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
          <Text style={styles.countText}>{rows.length} locations</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No locations found. Tap Add to create the first record.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.locationId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {row.locationName} <Text style={styles.code}>· {row.locationCode}</Text>
                    </Text>
                    <Text style={styles.sub}>{row.organizationName}</Text>
                  </View>
                </View>
                <Text style={styles.detailLine}>{row.addressLine1}{row.addressLine2 ? `, ${row.addressLine2}` : ''}</Text>
                <Text style={styles.detailLine}>{row.contactPerson} · {row.contactNo}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => setFormTarget({ row })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.locationId}>
                    {busyId === row.locationId ? <ActivityIndicator size="small" color="#b91c1c" /> : <Text style={styles.deleteText}>Archive</Text>}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {formTarget && (
        <LocationFormModal
          row={formTarget.row}
          orgOptions={orgOptions}
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

function LocationFormModal({
  row,
  orgOptions,
  onClose,
  onSaved,
}: {
  row?: LocationRow;
  orgOptions: LocationOrgOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [organizationId, setOrganizationId] = useState<number | ''>(row?.organizationId || '');
  const [locationName, setLocationName] = useState(row?.locationName || '');
  const [locationCode, setLocationCode] = useState(row?.locationCode || '');
  const [addr1, setAddr1] = useState(row?.addressLine1 || '');
  const [addr2, setAddr2] = useState(row?.addressLine2 || '');
  const [contactPerson, setContactPerson] = useState(row?.contactPerson || '');
  const [contactNo, setContactNo] = useState(row?.contactNo || '');
  const [remarks, setRemarks] = useState(row?.remarks || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!organizationId) return Alert.alert('Please select an Organization.');

    const payload: LocationPayload = {
      organizationId: Number(organizationId),
      locationName,
      locationCode,
      addressLine1: addr1,
      addressLine2: addr2,
      contactPerson,
      contactNo,
      remarks,
    };

    setSaving(true);
    try {
      if (isEdit) await updateLocation(row!.locationId, payload);
      else await createLocation(payload);
      Alert.alert('Saved', `Location ${isEdit ? 'updated' : 'created'} successfully.`);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Location' : 'Add Location'}</Text>

            <Text style={styles.label}>Organization *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={organizationId} onValueChange={(v) => setOrganizationId(v as number | '')}>
                <Picker.Item label="-- Select Organization --" value="" />
                {orgOptions.map((o) => (
                  <Picker.Item key={o.organizationId} label={o.organizationName} value={o.organizationId} />
                ))}
              </Picker>
            </View>

            <TextField label="Location Name *" value={locationName} onChangeText={setLocationName} />
            <TextField label="Location Code *" value={locationCode} onChangeText={setLocationCode} autoCapitalize="characters" />
            <TextField label="Address Line 1 *" value={addr1} onChangeText={setAddr1} />
            <TextField label="Address Line 2" value={addr2} onChangeText={setAddr2} />
            <TextField label="Contact Person *" value={contactPerson} onChangeText={setContactPerson} />
            <TextField label="Contact No *" value={contactNo} onChangeText={setContactNo} keyboardType="phone-pad" maxLength={10} />
            <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline numberOfLines={2} />

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
  code: { fontWeight: '500', color: A.muted },
  sub: { fontSize: 12, color: A.muted, marginTop: 2 },
  detailLine: { fontSize: 12, color: A.muted, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexGrow: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deleteText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '90%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  label: { fontSize: 13, color: A.muted, marginBottom: 6, fontWeight: '500' },
  pickerWrap: { borderWidth: 1, borderColor: A.border, borderRadius: radius.sm, marginBottom: 16, backgroundColor: A.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
