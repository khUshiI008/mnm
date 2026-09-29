import React, { useState } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  label?: string;
  /** 'day' expects/returns 'YYYY-MM-DD'; 'month' expects/returns 'YYYY-MM' (day is always forced to the 1st). */
  granularity?: 'day' | 'month';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  /** Override the outer wrapper (e.g. flex:1 + marginBottom:0 to sit inline in a From/To row). */
  style?: StyleProp<ViewStyle>;
  /** Override the pressable box (e.g. tighter padding to match a compact filter bar). */
  inputStyle?: StyleProp<ViewStyle>;
  /** Shows a small "Clear" link when a value is set, calling onChange(''). For genuinely optional fields. */
  clearable?: boolean;
  /** Mirrors TextInput's `editable={false}` — greys out the field and blocks opening the picker. */
  disabled?: boolean;
};

function parseValue(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map((v) => parseInt(v, 10));
  if (!y || !m) return new Date();
  return new Date(y, m - 1, d || 1);
}

function formatDisplay(value: string, granularity: 'day' | 'month'): string {
  const d = parseValue(value);
  return granularity === 'month' ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DateField({ label, granularity = 'day', value, onChange, placeholder, error, style, inputStyle, clearable, disabled }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const y = selected.getFullYear();
    const m = String(selected.getMonth() + 1).padStart(2, '0');
    onChange(granularity === 'month' ? `${y}-${m}` : `${y}-${m}-${String(selected.getDate()).padStart(2, '0')}`);
    if (Platform.OS === 'ios') setShowPicker(false);
  };

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {clearable && !!value && (
            <Pressable onPress={() => onChange('')} hitSlop={8}>
              <Text style={styles.clearLink}>Clear</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      <Pressable
        style={[styles.input, !!error && styles.inputError, disabled && styles.inputDisabled, inputStyle]}
        onPress={() => !disabled && setShowPicker(true)}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>{value ? formatDisplay(value, granularity) : placeholder || 'Select date'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {showPicker && (
        <DateTimePicker
          value={parseValue(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  clearLink: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.6 },
  valueText: { fontSize: 16, color: colors.text },
  placeholderText: { fontSize: 16, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
});
