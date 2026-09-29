import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../Button';
import TextField from '../TextField';
import { colors, radius, spacing } from '../../theme';
import { createShift, ShiftPayload, ShiftRow, updateShift } from '../../api/adminShiftApi';

const A = colors.admin;

/** Shared shift create/edit form — used by ShiftScreen's own list and as the quick-add modal from EmployeeFormScreen's inline Shift Assignment section. */
export default function ShiftFormModal({ row, onClose, onSaved }: { row?: ShiftRow; onClose: () => void; onSaved: (shiftId: number, shiftName: string) => void }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!row;
  const [shiftName, setShiftName] = useState(row?.shiftName || '');
  const [startTime, setStartTime] = useState(row?.startTime || '10:30');
  const [endTime, setEndTime] = useState(row?.endTime || '21:30');
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(String(row?.breakDurationMinutes ?? 45));
  const [graceTimeMinutes, setGraceTimeMinutes] = useState(String(row?.graceTimeMinutes ?? 15));
  const [graceOccurrencesPerMonth, setGraceOccurrencesPerMonth] = useState(String(row?.graceOccurrencesPerMonth ?? 4));
  const [lateChargeAmount, setLateChargeAmount] = useState(row?.lateChargeAmount ? String(row.lateChargeAmount) : '');
  const [earlyGoingAllowed, setEarlyGoingAllowed] = useState(row?.earlyGoingAllowed ?? true);
  const [otApplicable, setOtApplicable] = useState(row?.otApplicable ?? false);
  const [otBufferMinutes, setOtBufferMinutes] = useState(String(row?.otBufferMinutes ?? 15));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: ShiftPayload = {
      shiftName,
      startTime,
      endTime,
      breakDurationMinutes: Number(breakDurationMinutes),
      graceTimeMinutes: Number(graceTimeMinutes),
      graceOccurrencesPerMonth: Number(graceOccurrencesPerMonth),
      lateChargeAmount,
      earlyGoingAllowed,
      otApplicable,
      otBufferMinutes: Number(otBufferMinutes),
    };

    setSaving(true);
    try {
      const res = isEdit ? await updateShift(row!.shiftId, payload) : await createShift(payload);
      Alert.alert('Saved', `Shift ${isEdit ? 'updated' : 'created'} successfully.`);
      onSaved(res.data.shiftId, shiftName);
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
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Shift' : 'Add Shift'}</Text>

            <TextField label="Shift Name *" value={shiftName} onChangeText={setShiftName} />
            <TextField label="Start Time (HH:mm) *" value={startTime} onChangeText={setStartTime} placeholder="10:30" />
            <TextField label="End Time (HH:mm) *" value={endTime} onChangeText={setEndTime} placeholder="21:30" />
            <TextField label="Lunch / Break Duration (min, 0-180) *" value={breakDurationMinutes} onChangeText={setBreakDurationMinutes} keyboardType="number-pad" />
            <TextField label="Late Coming Grace Time (min, 0-120) *" value={graceTimeMinutes} onChangeText={setGraceTimeMinutes} keyboardType="number-pad" />
            <TextField label="Allowed Late Arrivals / Month (0-31) *" value={graceOccurrencesPerMonth} onChangeText={setGraceOccurrencesPerMonth} keyboardType="number-pad" />
            <TextField label="Late Charge Amount (₹, optional)" value={lateChargeAmount} onChangeText={setLateChargeAmount} keyboardType="decimal-pad" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Early Going Allowed</Text>
              <Switch value={earlyGoingAllowed} onValueChange={setEarlyGoingAllowed} trackColor={{ true: A.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>OT Applicable</Text>
              <Switch value={otApplicable} onValueChange={setOtApplicable} trackColor={{ true: A.primary }} />
            </View>

            <TextField label="OT Buffer Time (min, 0-120) *" value={otBufferMinutes} onChangeText={setOtBufferMinutes} keyboardType="number-pad" />

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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '92%', backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 16, fontWeight: '800', color: A.ink, marginBottom: spacing(1.5) },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchLabel: { fontSize: 13, color: A.ink, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1), marginBottom: spacing(2) },
});
