import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '../Button';
import TextField from '../TextField';
import { colors, radius, spacing } from '../../theme';

const A = colors.admin;

export type LeaveDecisionStatus = 'Approved' | 'Rejected' | 'Cancelled';
export type LeaveDecisionOption = { label: string; value: LeaveDecisionStatus };

export type LeaveDecisionTarget = { id: number; empName: string; shortCode: string };

/**
 * Shared "always requires a remark" modal — used both for a plain reject (single option)
 * and for changing an already-decided leave's status (multiple options to pick from).
 */
export default function LeaveDecisionModal({
  target,
  title,
  options,
  busy,
  onClose,
  onSubmit,
}: {
  target: LeaveDecisionTarget | null;
  title: string;
  options: LeaveDecisionOption[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (newStatus: LeaveDecisionStatus, remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState('');
  const [selected, setSelected] = useState<LeaveDecisionStatus | null>(null);

  useEffect(() => {
    setRemarks('');
    setSelected(options[0]?.value ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;

  const showPicker = options.length > 1;
  const trimmed = remarks.trim();
  const selectedOption = options.find((o) => o.value === selected);
  const canSubmit = !!selected && !!trimmed && !busy;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          {showPicker && (
            <View style={styles.optionsRow}>
              {options.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.optionChip, selected === opt.value && styles.optionChipActive]}
                  onPress={() => setSelected(opt.value)}
                >
                  <Text style={[styles.optionText, selected === opt.value && styles.optionTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <TextField label="Reason *" value={remarks} onChangeText={setRemarks} multiline numberOfLines={3} autoFocus={!showPicker} />

          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={selectedOption?.label ?? 'Submit'}
              onPress={() => selected && onSubmit(selected, trimmed)}
              loading={busy}
              disabled={!canSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  box: { width: '100%', backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },
  title: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  optionsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing(1.5), flexWrap: 'wrap' },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: A.border, backgroundColor: A.bg },
  optionChipActive: { borderColor: A.primary, backgroundColor: A.primary + '1a' },
  optionText: { fontSize: 13, fontWeight: '700', color: A.muted },
  optionTextActive: { color: A.primary },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing(1) },
});
