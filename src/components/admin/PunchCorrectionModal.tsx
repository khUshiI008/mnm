import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../Button';
import Icon from '../Icon';
import { colors, radius, spacing } from '../../theme';

const A = colors.admin;

export type EditablePunch = { time: string; source: 'device' | 'correction' | 'manual'; readOnly?: boolean };

type Props = {
  visible: boolean;
  title: string;
  meta: string;
  punches: EditablePunch[];
  showRemarks?: boolean;
  onClose: () => void;
  onSave: (times: string[], remarks: string) => Promise<void>;
};

/**
 * Shared punch-correction editor used by Attendance/Biometric Report + Partial
 * screens — mirrors the .NET admin panel's "Edit Punches" modal (add/remove
 * time rows, IN/OUT badges by alternating position, Save re-processes the day).
 */
export default function PunchCorrectionModal({ visible, title, meta, punches, showRemarks, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<EditablePunch[]>(punches);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setRows(punches);
      setRemarks('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const updateTime = (i: number, t: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, time: t } : row)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const addRow = () => setRows((r) => [...r, { time: '09:00', source: 'manual' }]);

  const handleSave = async () => {
    const times = rows.map((r) => r.time.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t));
    if (times.length !== rows.length) {
      Alert.alert('Invalid time', 'Every punch must be a valid HH:mm time.');
      return;
    }
    setSaving(true);
    try {
      await onSave(times.sort(), remarks);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing(4) + insets.bottom }]}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.meta}>{meta}</Text>

            {rows.length === 0 ? (
              <Text style={styles.empty}>No punches. Use "Add Punch" below.</Text>
            ) : (
              rows.map((row, i) => {
                const isIn = i % 2 === 0;
                const isLastOdd = i === rows.length - 1 && rows.length % 2 !== 0;
                const label = isLastOdd ? 'UNMATCHED' : isIn ? 'IN' : 'OUT';
                return (
                  <View key={i} style={styles.punchRow}>
                    <View style={[styles.badge, isLastOdd ? styles.badgePartial : isIn ? styles.badgeIn : styles.badgeOut]}>
                      <Text style={styles.badgeText}>{label}</Text>
                    </View>
                    <TextInput
                      style={[styles.timeInput, row.readOnly && styles.timeInputReadOnly]}
                      value={row.time}
                      onChangeText={(t) => updateTime(i, t)}
                      placeholder="HH:mm"
                      editable={!row.readOnly}
                    />
                    <Text style={styles.sourceTag}>{row.source === 'device' ? '📷 Device' : row.source === 'correction' ? '✎ Correction' : ''}</Text>
                    {!row.readOnly && (
                      <Pressable onPress={() => removeRow(i)} style={styles.delBtn}>
                        <Icon name="x" size={14} color={A.muted} />
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}

            <Pressable onPress={addRow} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add Punch</Text>
            </Pressable>

            {showRemarks && (
              <TextInput
                style={styles.remarksInput}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Remarks (optional)"
                placeholderTextColor={A.muted}
                multiline
              />
            )}

            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: A.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%' },
  content: { padding: spacing(2), paddingBottom: spacing(4) },
  title: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 4 },
  meta: { fontSize: 12, color: A.muted, marginBottom: 16 },
  empty: { fontSize: 12, color: A.muted, textAlign: 'center', paddingVertical: 16 },

  punchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 44, alignItems: 'center' },
  badgeIn: { backgroundColor: '#dcfce7' },
  badgeOut: { backgroundColor: '#fee2e2' },
  badgePartial: { backgroundColor: '#ffedd5' },
  badgeText: { fontSize: 9, fontWeight: '800', color: A.ink },
  timeInput: { flex: 1, borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: A.ink },
  timeInputReadOnly: { backgroundColor: A.bg, color: A.muted },
  sourceTag: { fontSize: 10, color: A.muted, width: 78 },
  delBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  addBtn: { paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: A.primary },

  remarksInput: { borderWidth: 1, borderColor: A.border, borderRadius: 8, padding: 10, fontSize: 13, color: A.ink, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
