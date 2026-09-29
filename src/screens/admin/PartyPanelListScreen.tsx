import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAdminNav } from '../../navigation/AdminShell';
import { getParties, togglePartyActive, deleteParty, PartyGridItem } from '../../api/adminPartyApi';

const A = colors.admin;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * No public-facing portal URL/app-store link exists anywhere in this
 * codebase's config yet (see config.ts) — rather than fabricate one, this
 * just tells the Party to open the already-installed app and log in with
 * their registered mobile number, matching Index.aspx.cs's WhatsApp-share
 * icon intent (send the Party a nudge to log in to their portal).
 */
function buildPortalMessage() {
  return 'Hello! You can access your Apna Payroll Party Portal any time — just open the Apna Payroll app and log in with your registered mobile number.';
}

/** Node port of Panel/Settings/PartyPanel/Index.aspx — Party CRUD list. */
export default function PartyPanelListScreen() {
  const { navigate } = useAdminNav();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PartyGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [viewRow, setViewRow] = useState<PartyGridItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getParties();
      setRows(res.data.parties);
    } catch {
      Alert.alert('Could not load Parties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      r.brandNamesDisplay.toLowerCase().includes(s) ||
      r.mobileNo.includes(s) ||
      (r.email || '').toLowerCase().includes(s) ||
      r.extraDescNamesDisplay.toLowerCase().includes(s)
    );
  });

  const handleToggle = (row: PartyGridItem) => {
    const activating = !row.isActive;
    Alert.alert(
      activating ? 'Reactivate this Party?' : 'Deactivate this Party?',
      activating ? 'This Party will be able to log in again.' : 'This Party will no longer be able to log in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: activating ? 'Reactivate' : 'Deactivate',
          style: activating ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(row.partyId);
            try {
              await togglePartyActive(row.partyId, activating);
              await load();
            } catch (err: any) {
              Alert.alert('Could not update', err?.response?.data?.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (row: PartyGridItem) => {
    Alert.alert(
      'Delete this Party?',
      `This permanently deletes ${row.brandNamesDisplay} and all of its linked Brands, Departments, Suppliers, Mobile Numbers, Extra Descriptions and Fast Moving Session overrides. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(row.partyId);
            try {
              await deleteParty(row.partyId);
              await load();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.response?.data?.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleWhatsApp = (row: PartyGridItem) => {
    const numbers = [row.mobileNo, ...row.additionalMobiles];
    const openFor = (mobile: string) => {
      const url = `https://wa.me/91${mobile}?text=${encodeURIComponent(buildPortalMessage())}`;
      Linking.openURL(url).catch(() => Alert.alert('Could not open WhatsApp', 'Please make sure WhatsApp is installed.'));
    };
    if (numbers.length === 1) {
      openFor(numbers[0]);
      return;
    }
    Alert.alert('Send Portal Link via WhatsApp', 'Choose which number to send to:', [
      { text: 'Cancel', style: 'cancel' },
      ...numbers.map((n) => ({ text: n, onPress: () => openFor(n) })),
    ]);
  };

  const handlePreview = (row: PartyGridItem) => {
    navigate('PartyDashboardPreview', { previewPartyId: row.partyId, title: `${row.brandNamesDisplay} — Preview` });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search brand, mobile, email..."
          placeholderTextColor={A.muted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.addBtn} onPress={() => navigate('PartyPanelForm', { title: 'Add Party' })}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>
      <View style={styles.secondRow}>
        <Pressable style={styles.fmBtn} onPress={() => navigate('FastMovingSessions', { title: 'Fast Moving Sessions' })}>
          <Text style={styles.fmBtnText}>Fast Moving Sessions</Text>
        </Pressable>
        <Pressable style={styles.fmBtn} onPress={() => navigate('CurrentSalePerfSessions', { title: 'Current Sale Performance Sessions' })}>
          <Text style={styles.fmBtnText}>Current Sale Performance Sessions</Text>
        </Pressable>
        <Pressable style={styles.fmBtn} onPress={() => navigate('PurchaseMovingSessions', { title: 'Purchase Moving Sessions' })}>
          <Text style={styles.fmBtnText}>Purchase Moving Sessions</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.countText}>{filtered.length} part{filtered.length === 1 ? 'y' : 'ies'}</Text>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No Parties found. Tap Add to create the first one.</Text>
          ) : (
            filtered.map((row) => (
              <Pressable key={row.partyId} style={styles.card} onPress={() => navigate('PartyPanelForm', { partyId: row.partyId, title: 'Edit Party' })}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.brandNamesDisplay}
                  </Text>
                  {!row.isActive && <Text style={styles.inactivePill}>Inactive</Text>}
                </View>
                <Text style={styles.sub}>
                  {row.mobileNo}
                  {row.additionalMobiles.length ? ` +${row.additionalMobiles.length} more` : ''}
                  {row.email ? ` · ${row.email}` : ''}
                </Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statChip}>{row.deptNamesDisplay}</Text>
                  {!!row.supplierNamesDisplay && <Text style={styles.statChip}>{row.supplierNamesDisplay}</Text>}
                  {!!row.extraDescNamesDisplay && <Text style={styles.statChip}>{row.extraDescNamesDisplay}</Text>}
                </View>
                <Text style={styles.dateText}>Added {formatDate(row.createdDate)}</Text>

                <View style={styles.actionsRow}>
                  <Pressable style={[styles.actionBtn, styles.viewBtn]} onPress={() => setViewRow(row)}>
                    <Text style={styles.viewText}>View</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => navigate('PartyPanelForm', { partyId: row.partyId, title: 'Edit Party' })}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.previewBtn]} onPress={() => handlePreview(row)}>
                    <Text style={styles.previewText}>Preview</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.whatsappBtn]} onPress={() => handleWhatsApp(row)}>
                    <Text style={styles.whatsappText}>WhatsApp</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, row.isActive ? styles.deactivateBtn : styles.reactivateBtn]}
                    onPress={() => handleToggle(row)}
                    disabled={busyId === row.partyId}
                  >
                    {busyId === row.partyId ? (
                      <ActivityIndicator size="small" color={row.isActive ? '#b91c1c' : '#15803d'} />
                    ) : (
                      <Text style={row.isActive ? styles.deactivateText : styles.reactivateText}>{row.isActive ? 'Deactivate' : 'Reactivate'}</Text>
                    )}
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(row)} disabled={busyId === row.partyId}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {viewRow && <PartyDetailModal row={viewRow} onClose={() => setViewRow(null)} />}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PartyDetailModal({ row, onClose }: { row: PartyGridItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {row.brandNamesDisplay}
              </Text>
              {!row.isActive && <Text style={styles.inactivePill}>Inactive</Text>}
            </View>

            <DetailRow label="Primary Mobile" value={row.mobileNo} />
            {row.additionalMobiles.length > 0 && <DetailRow label="Additional Mobile Numbers" value={row.additionalMobiles.join(', ')} />}
            <DetailRow label="Email" value={row.email || '—'} />
            <DetailRow label="Brands" value={row.brandNamesDisplay || '—'} />
            <DetailRow label="Departments" value={row.deptNamesDisplay || '—'} />
            <DetailRow label="Suppliers" value={row.supplierNamesDisplay || '—'} />
            <DetailRow label="Extra Descriptions" value={row.extraDescNamesDisplay || '—'} />
            <DetailRow label="Status" value={row.isActive ? 'Active' : 'Inactive'} />
            <DetailRow label="Created" value={`${formatDate(row.createdDate)}${row.createdBy ? ` by ${row.createdBy}` : ''}`} />
            <DetailRow
              label="Last Modified"
              value={row.modifiedDate ? `${formatDate(row.modifiedDate)}${row.modifiedBy ? ` by ${row.modifiedBy}` : ''}` : '—'}
            />

            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close</Text>
            </Pressable>
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
  secondRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing(2), marginTop: 8 },
  fmBtn: { alignSelf: 'flex-start', height: 36, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: A.border, alignItems: 'center', justifyContent: 'center' },
  fmBtnText: { color: A.ink, fontWeight: '700', fontSize: 12 },

  countText: { color: A.muted, fontSize: 12, marginBottom: spacing(1.5) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 14, fontWeight: '800', color: A.ink },
  inactivePill: { fontSize: 10, fontWeight: '700', color: '#b91c1c', backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  sub: { fontSize: 12, color: A.ink, marginBottom: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  statChip: { fontSize: 10.5, fontWeight: '700', color: A.ink, backgroundColor: A.surfaceRaised, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  dateText: { fontSize: 10.5, color: A.muted, marginBottom: 8 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: { flexGrow: 1, flexBasis: '30%', height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  viewBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  viewText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  editBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: A.border },
  editText: { color: A.ink, fontWeight: '700', fontSize: 12 },
  previewBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#93c5fd' },
  previewText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  whatsappBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#86efac' },
  whatsappText: { color: '#128c46', fontWeight: '700', fontSize: 12 },
  deactivateBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fca5a5' },
  deactivateText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  reactivateBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#86efac' },
  reactivateText: { color: '#15803d', fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#b91c1c', borderWidth: 1.5, borderColor: '#b91c1c' },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '85%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: spacing(1.5) },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: A.ink },
  detailRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: A.border },
  detailLabel: { fontSize: 11, color: A.muted, fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 13.5, color: A.ink, fontWeight: '600' },
  doneBtn: { marginTop: spacing(2.5), backgroundColor: A.primary, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
