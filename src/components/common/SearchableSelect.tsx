import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleProp, StyleSheet, Text, TextInput, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import Icon from '../Icon';

export type SelectItem = { label: string; value: string | number };

type SelectTheme = { surface: string; border: string; ink: string; muted: string; primary: string };

type Props = {
  items: SelectItem[];
  selectedValue: string | number;
  onValueChange: (value: string | number) => void;
  enabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  title?: string;
  theme?: SelectTheme;
  style?: StyleProp<ViewStyle>;
};

/**
 * Drop-in replacement for `<View style={styles.pickerWrap}><Picker>...</Picker></View>` —
 * opens a search-as-you-type modal instead of the native OS picker/spinner, which has no
 * way to filter a long employee/organization/location list.
 */
export default function SearchableSelect({
  items,
  selectedValue,
  onValueChange,
  enabled = true,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  title = 'Select',
  theme = colors.admin,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = items.find((i) => i.value === selectedValue);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.label.toLowerCase().includes(s));
  }, [items, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Pressable
        style={[
          styles.field,
          { borderColor: theme.border, backgroundColor: theme.surface },
          !enabled && styles.fieldDisabled,
          style,
        ]}
        onPress={() => enabled && setOpen(true)}
      >
        <Text
          style={[styles.fieldText, { color: selected ? theme.ink : theme.muted }]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="chevronDown" size={14} color={theme.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]} onPress={() => {}}>
            <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
            <TextInput
              style={[styles.search, { borderColor: theme.border, color: theme.ink }]}
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.muted}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filtered}
              keyExtractor={(i) => String(i.value)}
              style={{ maxHeight: 360 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.empty, { color: theme.muted }]}>No matches found</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    onValueChange(item.value);
                    close();
                  }}
                >
                  <Text
                    style={[
                      styles.rowText,
                      { color: item.value === selectedValue ? theme.primary : theme.ink },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  fieldDisabled: { opacity: 0.55 },
  fieldText: { fontSize: 14, flex: 1, marginRight: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'center', padding: spacing(2) },
  sheet: { borderRadius: radius.md, padding: 16, maxHeight: '70%' },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  search: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 8 },
  row: { paddingVertical: 10, borderBottomWidth: 1 },
  rowText: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 16, fontStyle: 'italic' },
});
