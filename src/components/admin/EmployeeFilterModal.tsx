import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { colors, radius, spacing } from '../../theme';

const A = colors.admin;

export type EmployeeOption = { employeeId: number; code: string; name: string };

type Props = {
  visible: boolean;
  employees: EmployeeOption[];
  onSelect: (emp: EmployeeOption | null) => void;
  onClose: () => void;
};

export default function EmployeeFilterModal({ visible, employees, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s));
  }, [employees, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Select Employee</Text>
          <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search name or code" placeholderTextColor={A.muted} />
          <Pressable
            style={styles.row}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          >
            <Text style={styles.rowText}>All Employees</Text>
          </Pressable>
          <FlatList
            data={filtered}
            keyExtractor={(e) => String(e.employeeId)}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.rowText}>
                  {item.code} — {item.name}
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.5)', justifyContent: 'center', padding: spacing(2) },
  sheet: { backgroundColor: A.surface, borderRadius: radius.md, padding: 16, maxHeight: '70%' },
  title: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 10 },
  search: { borderWidth: 1, borderColor: A.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: A.ink, marginBottom: 8 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  rowText: { fontSize: 13, color: A.ink, fontWeight: '600' },
});
